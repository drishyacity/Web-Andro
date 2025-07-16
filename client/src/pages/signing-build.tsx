import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Smartphone, ChevronRight, ChevronLeft, Key, Bolt, FileText, Settings, HelpCircle } from "lucide-react";
import { ProgressSteps } from "@/components/progress-steps";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, Build as BuildType } from "@shared/schema";

export default function SigningBuild() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [buildType, setBuildType] = useState<"apk" | "aab">("apk");
  const [keystorePath, setKeystorePath] = useState("");
  const [keystorePassword, setKeystorePassword] = useState("");
  const [keyAlias, setKeyAlias] = useState("");
  const [keyPassword, setKeyPassword] = useState("");
  const [enableOptimization, setEnableOptimization] = useState(true);
  const [enableObfuscation, setEnableObfuscation] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [currentBuild, setCurrentBuild] = useState<BuildType | null>(null);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: signingConfig } = useQuery({
    queryKey: ["/api/projects", projectId, "signing"],
    enabled: !!projectId,
  });

  const createBuildMutation = useMutation({
    mutationFn: async (buildData: any) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/builds`, buildData);
      return response.json();
    },
    onSuccess: (build) => {
      setCurrentBuild(build);
      setIsBuilding(true);
      setBuildProgress(0);
      
      // Poll for real build progress
      const pollBuildStatus = async () => {
        try {
          const response = await apiRequest("GET", `/api/builds/${build.id}`);
          const updatedBuild = await response.json();
          
          if (updatedBuild.status === 'success') {
            setBuildProgress(100);
            setIsBuilding(false);
            toast({
              title: "Build Complete",
              description: "Your Android app has been built successfully!",
            });
            setTimeout(() => {
              setLocation(`/download/${projectId}/${build.id}`);
            }, 1000);
          } else if (updatedBuild.status === 'failed') {
            setIsBuilding(false);
            setBuildProgress(0);
            toast({
              title: "Build Failed",
              description: updatedBuild.errorMessage || "Build failed with unknown error",
              variant: "destructive",
            });
          } else {
            // Update progress based on build status
            setBuildProgress(updatedBuild.status === 'building' ? 50 : 10);
            // Continue polling
            setTimeout(pollBuildStatus, 2000);
          }
        } catch (error) {
          console.error('Error polling build status:', error);
          setTimeout(pollBuildStatus, 3000);
        }
      };
      
      // Start polling after a brief delay
      setTimeout(pollBuildStatus, 1000);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start build",
        variant: "destructive",
      });
    },
  });

  const saveSigningConfigMutation = useMutation({
    mutationFn: async (configData: any) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/signing`, configData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "signing"] });
    },
  });

  const handleBuild = () => {
    if (!keystorePassword || !keyAlias || !keyPassword) {
      toast({
        title: "Error",
        description: "Please fill in all signing configuration fields",
        variant: "destructive",
      });
      return;
    }

    // Save signing config first
    const configData = {
      keystorePath: keystorePath || "Generated automatically",
      keystorePassword,
      keyAlias,
      keyPassword,
    };

    saveSigningConfigMutation.mutate(configData);

    // Start build
    const buildData = {
      buildType,
      status: 'building',
    };

    createBuildMutation.mutate(buildData);
  };

  const handlePrevious = () => {
    setLocation(`/config/${projectId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

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
        <ProgressSteps currentStep={3} />
        
        <div className="mt-8 space-y-6">
          {/* Bolt Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Bolt Type</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={buildType} onValueChange={(value) => setBuildType(value as "apk" | "aab")}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <RadioGroupItem value="apk" id="apk-build" className="peer sr-only" />
                    <Label htmlFor="apk-build" className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 peer-checked:border-primary peer-checked:bg-blue-50">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-primary mr-3" />
                        <div>
                          <div className="font-medium text-gray-900">APK</div>
                          <div className="text-sm text-gray-500">Android Package (Direct install)</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                  <div className="relative">
                    <RadioGroupItem value="aab" id="aab-build" className="peer sr-only" />
                    <Label htmlFor="aab-build" className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 peer-checked:border-primary peer-checked:bg-blue-50">
                      <div className="flex items-center">
                        <Bolt className="h-5 w-5 text-primary mr-3" />
                        <div>
                          <div className="font-medium text-gray-900">AAB</div>
                          <div className="text-sm text-gray-500">Android App Bundle (Play Store)</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Signing Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="h-5 w-5 mr-2" />
                Signing Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg mb-4">
                <p className="text-sm text-green-800">
                  <strong>Automatic Keystore Generation:</strong> We'll automatically create a secure keystore for your app.
                  Just provide the details below and we'll handle the technical setup.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="key-alias">App Key Name *</Label>
                  <Input
                    id="key-alias"
                    value={keyAlias}
                    onChange={(e) => setKeyAlias(e.target.value)}
                    placeholder="myapp-key"
                  />
                </div>
                <div>
                  <Label htmlFor="keystore-password">Keystore Password *</Label>
                  <Input
                    id="keystore-password"
                    type="password"
                    value={keystorePassword}
                    onChange={(e) => setKeystorePassword(e.target.value)}
                    placeholder="Create a secure password"
                  />
                </div>
                <div>
                  <Label htmlFor="key-password">Key Password *</Label>
                  <Input
                    id="key-password"
                    type="password"
                    value={keyPassword}
                    onChange={(e) => setKeyPassword(e.target.value)}
                    placeholder="Create a secure password"
                  />
                </div>
                <div>
                  <Label htmlFor="developer-name">Developer Name</Label>
                  <Input
                    id="developer-name"
                    value={keystorePath}
                    onChange={(e) => setKeystorePath(e.target.value)}
                    placeholder="Your name or company"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Security Note:</strong> Your keystore will be automatically generated and stored securely. 
                  Keep your passwords safe - you'll need them for future app updates.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bolt Options */}
          <Card>
            <CardHeader>
              <CardTitle>Bolt Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="optimization"
                  checked={enableOptimization}
                  onCheckedChange={setEnableOptimization}
                />
                <Label htmlFor="optimization" className="text-sm">
                  Enable code optimization (recommended)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="obfuscation"
                  checked={enableObfuscation}
                  onCheckedChange={setEnableObfuscation}
                />
                <Label htmlFor="obfuscation" className="text-sm">
                  Enable code obfuscation
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Bolt Status */}
          {isBuilding && (
            <Card>
              <CardHeader>
                <CardTitle>Bolt in Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={buildProgress} className="w-full" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Building your app...</span>
                    <span className="text-sm font-medium">{buildProgress}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-8">
          <Button variant="outline" onClick={handlePrevious} disabled={isBuilding}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              disabled={isBuilding}
            >
              New Project
            </Button>
            <Button 
              onClick={handleBuild}
              disabled={createBuildMutation.isPending || isBuilding}
              className="inline-flex items-center"
            >
              {isBuilding ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Building...
                </>
              ) : (
                <>
                  <Bolt className="h-4 w-4 mr-2" />
                  Start Build
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
