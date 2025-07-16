import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Smartphone, ChevronRight, ChevronLeft, Upload, Settings, HelpCircle } from "lucide-react";
import { ProgressSteps } from "@/components/progress-steps";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

export default function AppConfig() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [appName, setAppName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [versionCode, setVersionCode] = useState(1);
  const [description, setDescription] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      setLocation(`/signing/${projectId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project configuration",
        variant: "destructive",
      });
    },
  });

  // Initialize form with project data
  useEffect(() => {
    if (project) {
      setAppName(project.appName || "");
      setPackageName(project.packageName || "");
      setVersion(project.version || "1.0.0");
      setVersionCode(project.versionCode || 1);
      setDescription(project.description || "");
    }
  }, [project]);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
    }
  };

  const handleNextStep = () => {
    if (!appName || !packageName) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const updates = {
      appName,
      packageName,
      version,
      versionCode,
      description,
      // In a real implementation, you would upload the icon and logo files
      // and store their paths
    };

    updateProjectMutation.mutate(updates);
  };

  const handlePrevious = () => {
    setLocation("/");
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
        <ProgressSteps currentStep={2} />
        
        <div className="mt-8 space-y-6">
          {/* App Information */}
          <Card>
            <CardHeader>
              <CardTitle>App Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="app-name">App Name *</Label>
                  <Input
                    id="app-name"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="My Awesome App"
                  />
                </div>
                <div>
                  <Label htmlFor="package-name">Package Name *</Label>
                  <Input
                    id="package-name"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="com.example.myapp"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your app..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Version Information */}
          <Card>
            <CardHeader>
              <CardTitle>Version Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="version">Version Name</Label>
                  <Input
                    id="version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.0"
                  />
                </div>
                <div>
                  <Label htmlFor="version-code">Version Code</Label>
                  <Input
                    id="version-code"
                    type="number"
                    value={versionCode}
                    onChange={(e) => setVersionCode(parseInt(e.target.value) || 1)}
                    placeholder="1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* App Assets */}
          <Card>
            <CardHeader>
              <CardTitle>App Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="app-icon">App Icon</Label>
                  <div className="mt-2 flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      {iconFile ? (
                        <img 
                          src={URL.createObjectURL(iconFile)} 
                          alt="App Icon" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Smartphone className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <Button variant="outline" onClick={() => document.getElementById('icon-upload')?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Icon
                      </Button>
                      <input
                        id="icon-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleIconUpload}
                        className="hidden"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Recommended: 512x512 PNG
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="app-logo">App Logo</Label>
                  <div className="mt-2 flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      {logoFile ? (
                        <img 
                          src={URL.createObjectURL(logoFile)} 
                          alt="App Logo" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Smartphone className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <Button variant="outline" onClick={() => document.getElementById('logo-upload')?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </Button>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Optional: For splash screen
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>App Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-8 bg-gray-100 rounded-lg">
                <div className="text-center">
                  <div className="w-24 h-24 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                    {iconFile ? (
                      <img 
                        src={URL.createObjectURL(iconFile)} 
                        alt="App Icon" 
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      <Smartphone className="h-12 w-12 text-white" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {appName || "App Name"}
                  </h3>
                  <p className="text-sm text-gray-500">{version}</p>
                  <p className="text-sm text-gray-600 mt-2 max-w-xs">
                    {description || "No description provided"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-8">
          <Button variant="outline" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <Button 
            onClick={handleNextStep}
            disabled={updateProjectMutation.isPending}
          >
            Next Step
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </main>
    </div>
  );
}
