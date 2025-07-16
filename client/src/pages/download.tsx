import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Smartphone, Download as DownloadIcon, CheckCircle, XCircle, Clock, FileText, Bolt, ChevronLeft, Settings, HelpCircle, Loader2 } from "lucide-react";
import { ProgressSteps } from "@/components/progress-steps";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useBuildProgress } from "@/hooks/use-build-progress";
import type { Build as BuildType, Project } from "@shared/schema";

export default function Download() {
  const { projectId, buildId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: build, isLoading } = useQuery<BuildType>({
    queryKey: ["/api/builds", buildId],
    enabled: !!buildId,
    refetchInterval: (data) => data?.status === 'building' ? 1000 : false,
  });

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", build?.projectId],
    enabled: !!build?.projectId,
  });

  const { progress, isComplete, result } = useBuildProgress(buildId || null);

  const handleDownload = async (fileType: 'apk' | 'aab' | 'complete') => {
    if (!build || build.status !== 'success') return;

    try {
      const response = await apiRequest("GET", `/api/builds/${build.id}/download/${fileType}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Get the filename from Content-Disposition header or use default
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition 
        ? disposition.split('filename=')[1]?.replace(/"/g, '') 
        : `app-${build.id}.${fileType === 'complete' ? 'zip' : fileType}`;

      // Convert response to blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: `${fileType === 'complete' ? 'Complete package' : fileType.toUpperCase()} download started successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to download ${fileType === 'complete' ? 'complete package' : fileType.toUpperCase()}`,
        variant: "destructive",
      });
    }
  };

  const handleNewBuild = () => {
    if (project) {
      setLocation(`/signing/${project.id}`);
    }
  };

  const handleBackToProjects = () => {
    setLocation("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading build...</p>
        </div>
      </div>
    );
  }

  if (!build) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Bolt Not Found</h2>
              <p className="text-gray-600 mb-4">
                The requested build could not be found.
              </p>
              <Button onClick={handleBackToProjects}>
                Back to Projects
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'building':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'success':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'building':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Smartphone className="h-8 w-8 text-primary mr-3" />
                <h1 className="text-xl font-bold text-gray-900">WebApp to APK Builder</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => toast({ title: "Help", description: "Documentation coming soon!" })}>
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toast({ title: "Settings", description: "Settings panel coming soon!" })}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProgressSteps currentStep={4} />
        
        <div className="mt-8 space-y-6">
          {/* Bolt Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Bolt Status</span>
                <Badge variant={getStatusVariant(build.status)} className="flex items-center">
                  {getStatusIcon(build.status)}
                  <span className="ml-2 capitalize">{build.status}</span>
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Bolt Type</Label>
                  <div className="flex items-center mt-1">
                    {build.buildType === 'apk' ? (
                      <FileText className="h-4 w-4 text-primary mr-2" />
                    ) : (
                      <Bolt className="h-4 w-4 text-primary mr-2" />
                    )}
                    <span className="text-sm font-medium uppercase">{build.buildType}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Started</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {build.startedAt ? new Date(build.startedAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Completed</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {build.completedAt ? new Date(build.completedAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Real-time Build Progress */}
          {(build.status === 'building' || progress) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Build Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {progress && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">
                          {progress.step.charAt(0).toUpperCase() + progress.step.slice(1)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {progress.progress}%
                        </span>
                      </div>
                      <Progress value={progress.progress} className="w-full" />
                      <p className="text-sm text-gray-600 mt-2">
                        {progress.message}
                      </p>
                    </>
                  )}
                  
                  {!progress && build.status === 'building' && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <span className="text-sm text-gray-600">
                        Initializing build process...
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Project Information */}
          {project && (
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">App Name</Label>
                    <p className="text-sm text-gray-900 mt-1">{project.appName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Package Name</Label>
                    <p className="text-sm text-gray-900 mt-1">{project.packageName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Version</Label>
                    <p className="text-sm text-gray-900 mt-1">{project.version}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Input Type</Label>
                    <p className="text-sm text-gray-900 mt-1 capitalize">{project.inputType}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Download Section */}
          {build.status === 'success' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DownloadIcon className="h-5 w-5 mr-2" />
                  Download Your App
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center mb-4">
                    <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
                    <div>
                      <h3 className="font-medium text-green-900">Build Successful!</h3>
                      <p className="text-sm text-green-700">
                        Your Android app has been built successfully. Choose your download format:
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      onClick={() => handleDownload('apk')} 
                      className="flex items-center justify-center h-12"
                      variant="default"
                    >
                      <Smartphone className="h-5 w-5 mr-2" />
                      Download APK
                      <span className="ml-2 text-xs opacity-75">(Direct Install)</span>
                    </Button>
                    
                    <Button 
                      onClick={() => handleDownload('aab')} 
                      className="flex items-center justify-center h-12"
                      variant="outline"
                    >
                      <Bolt className="h-5 w-5 mr-2" />
                      Download AAB
                      <span className="ml-2 text-xs opacity-75">(Play Store)</span>
                    </Button>
                    
                    <Button 
                      onClick={() => handleDownload('complete')} 
                      className="flex items-center justify-center h-12"
                      variant="secondary"
                    >
                      <DownloadIcon className="h-5 w-5 mr-2" />
                      Complete Package
                      <span className="ml-2 text-xs opacity-75">(APK + AAB + Keystore)</span>
                    </Button>
                  </div>
                  
                  <div className="mt-4 text-xs text-gray-600">
                    <p><strong>APK:</strong> Install directly on Android devices</p>
                    <p><strong>AAB:</strong> Upload to Google Play Store for distribution</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Section */}
          {build.status === 'failed' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-red-600">
                  <XCircle className="h-5 w-5 mr-2" />
                  Bolt Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-800">
                    {build.errorMessage || 'An error occurred during the build process.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Building Section */}
          {build.status === 'building' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-yellow-600">
                  <Clock className="h-5 w-5 mr-2" />
                  Bolt in Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Your build is currently in progress. Please wait while we generate your {build.buildType.toUpperCase()} file.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button variant="outline" onClick={handleNewBuild}>
                  <Bolt className="h-4 w-4 mr-2" />
                  New Bolt
                </Button>
                <Button variant="outline" onClick={handleBackToProjects}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm font-medium ${className}`}>
      {children}
    </label>
  );
}
