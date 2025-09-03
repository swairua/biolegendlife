import { supabase } from '@/integrations/supabase/client';

/**
 * Fix RLS policies for proforma tables with improved logic
 */
export async function fixProformaRLSPolicies() {
  console.log('🔧 Fixing proforma RLS policies...');

  const fixSQL = `
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view proformas from their company" ON proforma_invoices;
DROP POLICY IF EXISTS "Users can insert proformas for their company" ON proforma_invoices;
DROP POLICY IF EXISTS "Users can update proformas from their company" ON proforma_invoices;
DROP POLICY IF EXISTS "Users can delete proformas from their company" ON proforma_invoices;

DROP POLICY IF EXISTS "Users can view proforma items from their company" ON proforma_items;
DROP POLICY IF EXISTS "Users can insert proforma items for their company" ON proforma_items;
DROP POLICY IF EXISTS "Users can update proforma items from their company" ON proforma_items;
DROP POLICY IF EXISTS "Users can delete proforma items from their company" ON proforma_items;

-- Create improved RLS policies for proforma_invoices with better NULL handling
CREATE POLICY "Users can view proformas from their company" ON proforma_invoices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.company_id IS NOT NULL 
            AND profiles.company_id = proforma_invoices.company_id
        )
    );

CREATE POLICY "Users can insert proformas for their company" ON proforma_invoices
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.company_id IS NOT NULL 
            AND profiles.company_id = proforma_invoices.company_id
        )
    );

CREATE POLICY "Users can update proformas from their company" ON proforma_invoices
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.company_id IS NOT NULL 
            AND profiles.company_id = proforma_invoices.company_id
        )
    );

CREATE POLICY "Users can delete proformas from their company" ON proforma_invoices
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.company_id IS NOT NULL 
            AND profiles.company_id = proforma_invoices.company_id
        )
    );

-- Create improved RLS policies for proforma_items
CREATE POLICY "Users can view proforma items from their company" ON proforma_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM proforma_invoices pi
            INNER JOIN profiles p ON p.company_id = pi.company_id
            WHERE pi.id = proforma_items.proforma_id
            AND p.id = auth.uid()
            AND p.company_id IS NOT NULL
        )
    );

CREATE POLICY "Users can insert proforma items for their company" ON proforma_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM proforma_invoices pi
            INNER JOIN profiles p ON p.company_id = pi.company_id
            WHERE pi.id = proforma_items.proforma_id
            AND p.id = auth.uid()
            AND p.company_id IS NOT NULL
        )
    );

CREATE POLICY "Users can update proforma items from their company" ON proforma_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM proforma_invoices pi
            INNER JOIN profiles p ON p.company_id = pi.company_id
            WHERE pi.id = proforma_items.proforma_id
            AND p.id = auth.uid()
            AND p.company_id IS NOT NULL
        )
    );

CREATE POLICY "Users can delete proforma items from their company" ON proforma_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM proforma_invoices pi
            INNER JOIN profiles p ON p.company_id = pi.company_id
            WHERE pi.id = proforma_items.proforma_id
            AND p.id = auth.uid()
            AND p.company_id IS NOT NULL
        )
    );
`;

  try {
    // Execute the SQL to fix policies
    const { error } = await supabase.rpc('exec_sql', { sql: fixSQL });
    
    if (error) {
      console.error('Failed to fix RLS policies:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ RLS policies fixed successfully');
    return { success: true };

  } catch (error) {
    console.error('Exception fixing RLS policies:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Test RLS policies by attempting an update
 */
export async function testRLSPolicies(proformaId: string) {
  console.log('🧪 Testing RLS policies...');

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Test SELECT permission
    const { data: selectData, error: selectError } = await supabase
      .from('proforma_invoices')
      .select('id, company_id')
      .eq('id', proformaId)
      .maybeSingle();

    if (selectError) {
      return { success: false, error: `SELECT failed: ${selectError.message}` };
    }

    if (!selectData) {
      return { success: false, error: 'SELECT returned no data - RLS blocking' };
    }

    // Test UPDATE permission
    const { data: updateData, error: updateError } = await supabase
      .from('proforma_invoices')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', proformaId)
      .select('id')
      .maybeSingle();

    if (updateError) {
      return { success: false, error: `UPDATE failed: ${updateError.message}` };
    }

    if (!updateData) {
      return { success: false, error: 'UPDATE returned no data - RLS still blocking' };
    }

    console.log('✅ RLS policies test passed');
    return { success: true };

  } catch (error) {
    console.error('Exception testing RLS policies:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Debug RLS by showing auth context
 */
export async function debugRLSContext() {
  console.log('🔍 Debugging RLS context...');

  try {
    // Get auth context using a direct query
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          auth.uid() as auth_uid,
          (SELECT id FROM profiles WHERE id = auth.uid()) as profile_exists,
          (SELECT company_id FROM profiles WHERE id = auth.uid()) as user_company_id,
          (SELECT COUNT(*) FROM companies) as companies_count,
          current_setting('role') as current_role
      `
    });

    if (error) {
      console.error('Debug query failed:', error);
      return { success: false, error: error.message };
    }

    console.log('🔍 RLS Debug Context:', data);
    return { success: true, data: data };

  } catch (error) {
    console.error('Exception debugging RLS:', error);
    return { success: false, error: String(error) };
  }
}
