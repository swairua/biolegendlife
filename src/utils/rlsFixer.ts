import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Utility functions to fix RLS permission issues
 */

export interface RLSFixResult {
  success: boolean;
  message: string;
  actions: string[];
}

/**
 * Check and ensure user has proper profile setup
 */
export async function ensureUserProfile(): Promise<RLSFixResult> {
  const result: RLSFixResult = {
    success: false,
    message: '',
    actions: []
  };

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      result.message = 'User not authenticated';
      result.actions.push('Please log in again');
      return result;
    }

    // Check if user has a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      result.message = `Profile check failed: ${profileError.message}`;
      result.actions.push('Contact support to fix profile issues');
      return result;
    }

    if (!profile) {
      // Try to create a profile
      result.actions.push('Creating missing user profile...');
      
      const { data: companies } = await supabase
        .from('companies')
        .select('id')
        .limit(1);

      if (!companies || companies.length === 0) {
        result.message = 'No companies found in the system';
        result.actions.push('Create a company first');
        return result;
      }

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          email: user.email,
          company_id: companies[0].id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
        }])
        .select()
        .maybeSingle();

      if (createError) {
        result.message = `Failed to create profile: ${createError.message}`;
        result.actions.push('Contact support to create profile manually');
        return result;
      }

      result.success = true;
      result.message = `Profile created successfully with company ${companies[0].id}`;
      result.actions.push('Profile created', 'Try updating the proforma again');
      return result;
    }

    if (!profile.company_id) {
      result.message = 'User profile exists but has no company assigned';
      result.actions.push('Contact admin to assign you to a company');
      return result;
    }

    result.success = true;
    result.message = `Profile exists with company ${profile.company_id}`;
    result.actions.push('Profile is properly configured');
    return result;

  } catch (error) {
    result.message = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
    result.actions.push('Contact support for assistance');
    return result;
  }
}

/**
 * Check if proforma belongs to user's company and fix if possible
 */
export async function fixProformaCompanyAccess(proformaId: string): Promise<RLSFixResult> {
  const result: RLSFixResult = {
    success: false,
    message: '',
    actions: []
  };

  try {
    // Get current user and profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      result.message = 'User not authenticated';
      return result;
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile?.company_id) {
      result.message = 'User has no company assigned';
      result.actions.push('Run "Fix Profile" first');
      return result;
    }

    // Check proforma company - use a more permissive query
    const { data: proforma, error: proformaError } = await supabase
      .from('proforma_invoices')
      .select('company_id, proforma_number')
      .eq('id', proformaId)
      .maybeSingle();

    if (proformaError) {
      result.message = `Cannot access proforma: ${proformaError.message}`;
      result.actions.push('You may not have permission to view this proforma');
      return result;
    }

    if (!proforma) {
      result.message = 'Proforma not found or access denied';
      result.actions.push('Check if the proforma exists and you have access');
      return result;
    }

    if (proforma.company_id === userProfile.company_id) {
      result.success = true;
      result.message = 'Company access is correct';
      result.actions.push('No company mismatch detected');
      return result;
    }

    result.message = `Company mismatch: Your company (${userProfile.company_id}) != Proforma company (${proforma.company_id})`;
    result.actions.push('Contact admin to transfer proforma to your company', 'Or request access to the proforma\'s company');
    return result;

  } catch (error) {
    result.message = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
    result.actions.push('Contact support for assistance');
    return result;
  }
}

/**
 * Attempt to fix RLS issues step by step
 */
export async function attemptRLSFix(proformaId: string): Promise<RLSFixResult> {
  const result: RLSFixResult = {
    success: false,
    message: '',
    actions: []
  };

  try {
    // Step 1: Ensure user profile
    result.actions.push('Step 1: Checking user profile...');
    const profileResult = await ensureUserProfile();
    
    if (!profileResult.success) {
      result.message = `Profile issue: ${profileResult.message}`;
      result.actions.push(...profileResult.actions);
      return result;
    }

    result.actions.push('✓ Profile check passed');

    // Step 2: Check company access
    result.actions.push('Step 2: Checking company access...');
    const companyResult = await fixProformaCompanyAccess(proformaId);
    
    if (!companyResult.success) {
      result.message = `Company access issue: ${companyResult.message}`;
      result.actions.push(...companyResult.actions);
      return result;
    }

    result.actions.push('✓ Company access verified');

    // Step 3: Test update permission
    result.actions.push('Step 3: Testing update permission...');
    const { data: updateTest, error: updateError } = await supabase
      .from('proforma_invoices')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', proformaId)
      .select('id')
      .maybeSingle();

    if (updateError) {
      result.message = `Update test failed: ${updateError.message}`;
      result.actions.push('RLS policy is still blocking updates');
      result.actions.push('Contact database administrator');
      return result;
    }

    if (!updateTest) {
      result.message = 'Update test returned no data - RLS still blocking';
      result.actions.push('RLS policy configuration issue');
      result.actions.push('Contact database administrator');
      return result;
    }

    result.success = true;
    result.message = 'All RLS checks passed! You should be able to update the proforma now.';
    result.actions.push('✓ Update permission verified');
    result.actions.push('Try updating the proforma again');

  } catch (error) {
    result.message = `Fix attempt failed: ${error instanceof Error ? error.message : String(error)}`;
    result.actions.push('Contact support for manual assistance');
  }

  return result;
}

/**
 * Create a bypass function for emergency situations (requires elevated permissions)
 */
export async function createEmergencyBypass(proformaId: string): Promise<RLSFixResult> {
  const result: RLSFixResult = {
    success: false,
    message: '',
    actions: []
  };

  try {
    // This would only work if the user has elevated permissions
    // or if we implement an admin override function
    
    result.message = 'Emergency bypass not implemented yet';
    result.actions.push('Contact system administrator');
    result.actions.push('Provide proforma ID: ' + proformaId);
    
    return result;

  } catch (error) {
    result.message = `Bypass failed: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
}

/**
 * Get detailed RLS policy information
 */
export async function getRLSPolicyInfo(): Promise<string[]> {
  const info = [
    'RLS Policies for proforma_invoices:',
    '',
    '1. SELECT: company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
    '2. INSERT: company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
    '3. UPDATE: company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
    '4. DELETE: company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())',
    '',
    'Requirements:',
    '- User must be authenticated (auth.uid() returns valid ID)',
    '- User must have a profile record in the profiles table',
    '- Profile must have a company_id that matches the proforma\'s company_id',
    '',
    'Common Issues:',
    '- Missing profile record',
    '- Profile has null company_id',
    '- Proforma belongs to different company',
    '- Authentication token expired'
  ];

  return info;
}
