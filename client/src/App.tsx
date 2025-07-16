import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AppConfig from "@/pages/app-config";
import SigningBuild from "@/pages/signing-build";
import Download from "@/pages/download";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/config/:projectId" component={AppConfig} />
      <Route path="/signing/:projectId" component={SigningBuild} />
      <Route path="/download/:projectId/:buildId" component={Download} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
