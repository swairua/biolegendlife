import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  RefreshCw,
  User,
  Building,
  FileText,
  CheckCircle,
  XCircle,
  Wrench,
  Info
} from 'lucide-react';
import { logProformaRLSDiagnostics, diagnoseProformaRLS, type RLSDiagnostics } from '@/utils/rlsDiagnostics';
import { attemptRLSFix, type RLSFixResult } from '@/utils/rlsFixer';
import { toast } from 'sonner';

interface ProformaUpdateErrorHandlerProps {
  error: string;
  proformaId: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ProformaUpdateErrorHandler = ({
  error,
  proformaId,
  onRetry,
  onDismiss
}: ProformaUpdateErrorHandlerProps) => {
  const [diagnostics, setDiagnostics] = useState<RLSDiagnostics | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [fixResult, setFixResult] = useState<RLSFixResult | null>(null);
  const [isAttemptingFix, setIsAttemptingFix] = useState(false);

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const result = await diagnoseProformaRLS(proformaId);
      setDiagnostics(result);

      if (result.errors.length === 0) {
        toast.success('No RLS issues detected - try updating again');
      } else {
        toast.warning(`Found ${result.errors.length} potential issues`);
      }
    } catch (diagError) {
      console.error('Diagnostics failed:', diagError);
      toast.error('Failed to run diagnostics');
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const attemptFix = async () => {
    setIsAttemptingFix(true);
    setFixResult(null);

    try {
      toast.info('Attempting to fix RLS issues...');
      const result = await attemptRLSFix(proformaId);
      setFixResult(result);

      if (result.success) {
        toast.success('RLS issues fixed! Try updating again.');
      } else {
        toast.error(`Fix attempt failed: ${result.message}`);
      }
    } catch (fixError) {
      console.error('Fix attempt failed:', fixError);
      setFixResult({
        success: false,
        message: fixError instanceof Error ? fixError.message : 'Unknown error',
        actions: ['Contact support for assistance']
      });
      toast.error('Failed to fix RLS issues');
    } finally {
      setIsAttemptingFix(false);
    }
  };

  const getDiagnosticStatus = (value: boolean | null): 'success' | 'error' | 'warning' => {
    if (value === null) return 'warning';
    return value ? 'success' : 'error';
  };

  const getStatusIcon = (status: 'success' | 'error' | 'warning') => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
  };

  return (
    <Alert className="border-destructive/50">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Proforma Update Failed</AlertTitle>
      <AlertDescription className="space-y-4">
        <p className="text-sm">{error}</p>
        
        {error.includes('no data returned') || error.includes('permission') || error.includes('access') ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This usually happens due to permission issues. Click "Run Diagnostics" to check your access.
            </p>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={runDiagnostics}
                disabled={isRunningDiagnostics}
              >
                {isRunningDiagnostics ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Run Diagnostics
              </Button>
              
              {onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              
              {onDismiss && (
                <Button variant="ghost" size="sm" onClick={onDismiss}>
                  Dismiss
                </Button>
              )}
            </div>

            {diagnostics && (
              <Card className="border-muted">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Access Diagnostics
                  </CardTitle>
                  <CardDescription>
                    Checking your permissions and access to this proforma
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm flex items-center gap-2">
                          <User className="h-4 w-4" />
                          User Authentication
                        </span>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(getDiagnosticStatus(!!diagnostics.userId))}
                          <Badge variant={getDiagnosticStatus(!!diagnostics.userId) === 'success' ? 'default' : 'destructive'}>
                            {diagnostics.userId ? 'OK' : 'Failed'}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm flex items-center gap-2">
                          <User className="h-4 w-4" />
                          User Profile
                        </span>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(getDiagnosticStatus(diagnostics.hasProfile))}
                          <Badge variant={getDiagnosticStatus(diagnostics.hasProfile) === 'success' ? 'default' : 'destructive'}>
                            {diagnostics.hasProfile ? 'Found' : 'Missing'}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Company Access
                        </span>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(getDiagnosticStatus(diagnostics.canAccessProforma))}
                          <Badge variant={getDiagnosticStatus(diagnostics.canAccessProforma) === 'success' ? 'default' : 'destructive'}>
                            {diagnostics.canAccessProforma ? 'Allowed' : 'Denied'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        <p><strong>User Company:</strong> {diagnostics.userCompanyId || 'None'}</p>
                        <p><strong>Proforma Company:</strong> {diagnostics.proformaCompanyId || 'Unknown'}</p>
                      </div>
                    </div>
                  </div>

                  {diagnostics.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-destructive">Issues Found:</h4>
                      <ul className="text-xs space-y-1">
                        {diagnostics.errors.map((error, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <XCircle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {diagnostics.errors.length === 0 && (
                    <div className="text-sm text-success flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      No permission issues detected
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};
