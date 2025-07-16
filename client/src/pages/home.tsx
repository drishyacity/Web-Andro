import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Smartphone, Globe, Upload, Eye, ChevronRight, ChevronLeft, Settings, HelpCircle } from "lucide-react";
import { ProgressSteps } from "@/components/progress-steps";
import { FileUpload } from "@/components/file-upload";
import { ProjectPreview } from "@/components/project-preview";
import { Sidebar } from "@/components/sidebar";
import { ErrorModal } from "@/components/error-modal";
import { LoadingModal } from "@/components/loading-modal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [inputMethod, setInputMethod] = useState<"url" | "files">("url");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [responsiveCheck, setResponsiveCheck] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: any) => {
      const response = await apiRequest("POST", "/api/projects", projectData);
      return response.json();
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setLocation(`/config/${project.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const testUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/test-url", { url });
      return response.json();
    },
    onSuccess: (result) => {
      if (result.valid) {
        toast({
          title: "Success",
          description: "URL is valid and accessible",
        });
      } else {
        setErrorMessage("URL is not accessible or invalid");
        setShowErrorModal(true);
      }
    },
    onError: () => {
      setErrorMessage("Failed to test URL");
      setShowErrorModal(true);
    },
  });

  const handleTestUrl = () => {
    if (!websiteUrl) {
      setErrorMessage("Please enter a URL");
      setShowErrorModal(true);
      return;
    }
    testUrlMutation.mutate(websiteUrl);
  };

  const handleNextStep = () => {
    if (inputMethod === "url") {
      if (!websiteUrl) {
        setErrorMessage("Please enter a website URL");
        setShowErrorModal(true);
        return;
      }
      
      const projectData = {
        name: "Web App Project",
        description: "Generated from URL",
        inputType: "url",
        websiteUrl,
        packageName: "com.example.webapp",
        appName: "WebApp",
        version: "1.0.0",
        versionCode: 1,
      };
      
      createProjectMutation.mutate(projectData);
    } else {
      if (uploadedFiles.length === 0) {
        setErrorMessage("Please upload at least one file");
        setShowErrorModal(true);
        return;
      }
      
      const projectData = {
        name: "File Upload Project",
        description: "Generated from uploaded files",
        inputType: "files",
        packageName: "com.example.webapp",
        appName: "WebApp",
        version: "1.0.0",
        versionCode: 1,
      };
      
      createProjectMutation.mutate(projectData);
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProgressSteps currentStep={1} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Welcome Message */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to APK Builder</h2>
                  <p className="text-gray-600 mb-4">
                    Convert your website or web files into Android APK/AAB packages in just a few steps
                  </p>
                  <div className="flex justify-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      Easy Setup
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                      Auto Signing
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                      Ready to Install
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Input Method Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Choose Input Method</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={inputMethod} onValueChange={(value) => setInputMethod(value as "url" | "files")}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <RadioGroupItem value="url" id="url-input" className="peer sr-only" />
                      <Label htmlFor="url-input" className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all peer-checked:border-primary peer-checked:bg-blue-50">
                        <div className="flex items-center">
                          <Globe className="h-5 w-5 text-primary mr-3" />
                          <div>
                            <div className="font-medium text-gray-900">Website URL</div>
                            <div className="text-sm text-gray-500">Enter a URL to convert</div>
                          </div>
                        </div>
                      </Label>
                    </div>
                    <div className="relative">
                      <RadioGroupItem value="files" id="file-input" className="peer sr-only" />
                      <Label htmlFor="file-input" className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all peer-checked:border-primary peer-checked:bg-blue-50">
                        <div className="flex items-center">
                          <Upload className="h-5 w-5 text-primary mr-3" />
                          <div>
                            <div className="font-medium text-gray-900">Upload Files</div>
                            <div className="text-sm text-gray-500">HTML, CSS, JS files</div>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* URL Input Section */}
            {inputMethod === "url" && (
              <Card>
                <CardHeader>
                  <CardTitle>Website URL</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="website-url">Enter Website URL</Label>
                    <div className="relative mt-2">
                      <Input
                        id="website-url"
                        type="url"
                        placeholder="https://example.com"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        className="pl-10"
                      />
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="responsive-check"
                      checked={responsiveCheck}
                      onCheckedChange={setResponsiveCheck}
                    />
                    <Label htmlFor="responsive-check" className="text-sm text-gray-600">
                      Ensure responsive design compatibility
                    </Label>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleTestUrl}
                    disabled={testUrlMutation.isPending}
                    className="inline-flex items-center"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Test URL
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* File Upload Section */}
            {inputMethod === "files" && (
              <Card>
                <CardHeader>
                  <CardTitle>Upload Project Files</CardTitle>
                </CardHeader>
                <CardContent>
                  <FileUpload 
                    files={uploadedFiles}
                    onFilesChange={setUploadedFiles}
                  />
                </CardContent>
              </Card>
            )}

            {/* Preview Section */}
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectPreview 
                  inputMethod={inputMethod}
                  websiteUrl={websiteUrl}
                  files={uploadedFiles}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Sidebar projects={projects} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-8">
          <Button variant="outline" disabled>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <Button 
            onClick={handleNextStep}
            disabled={createProjectMutation.isPending}
            className="inline-flex items-center"
          >
            Next Step
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </main>

      {/* Modals */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={errorMessage}
        onRetry={() => {
          setShowErrorModal(false);
          if (inputMethod === "url") {
            handleTestUrl();
          }
        }}
      />
      
      <LoadingModal
        isOpen={testUrlMutation.isPending}
        message="Testing URL..."
      />
    </div>
  );
}
