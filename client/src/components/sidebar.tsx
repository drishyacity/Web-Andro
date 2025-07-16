import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Smartphone, Book, Video, LifeBuoy, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Project, BuildStats } from "@shared/schema";

interface SidebarProps {
  projects: Project[];
}

export function Sidebar({ projects }: SidebarProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: stats } = useQuery<BuildStats>({
    queryKey: ["/api/stats"],
  });

  const recentProjects = projects.slice(0, 3);
  
  const handleProjectClick = (project: Project) => {
    setLocation(`/config/${project.id}`);
  };
  
  const handleHelpClick = (type: string) => {
    toast({
      title: "Help",
      description: `${type} coming soon!`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Build Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Builds</span>
              <span className="text-sm font-medium text-gray-900">
                {stats?.totalBuilds || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Successful Builds</span>
              <span className="text-sm font-medium text-green-600">
                {stats?.successfulBuilds || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last Build</span>
              <span className="text-sm font-medium text-gray-900">
                {stats?.lastBuildAt 
                  ? new Date(stats.lastBuildAt).toLocaleDateString()
                  : "Never"
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentProjects.length > 0 ? (
              recentProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100" onClick={() => handleProjectClick(project)}>
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
                      <Smartphone className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{project.appName}</div>
                      <div className="text-xs text-gray-500">
                        {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : ''}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toast({ title: "More Options", description: "Project options coming soon!" }); }}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">No recent projects</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card>
        <CardHeader>
          <CardTitle>Help & Support</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <button onClick={() => handleHelpClick("Documentation")} className="flex items-center text-sm text-gray-600 hover:text-primary w-full text-left">
              <Book className="h-4 w-4 mr-2" />
              Documentation
            </button>
            <button onClick={() => handleHelpClick("Video Tutorials")} className="flex items-center text-sm text-gray-600 hover:text-primary w-full text-left">
              <Video className="h-4 w-4 mr-2" />
              Video Tutorials
            </button>
            <button onClick={() => handleHelpClick("Support Center")} className="flex items-center text-sm text-gray-600 hover:text-primary w-full text-left">
              <LifeBuoy className="h-4 w-4 mr-2" />
              Support Center
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
