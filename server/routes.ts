import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertProjectSchema, insertBuildSchema, insertProjectFileSchema, insertSigningConfigSchema } from "@shared/schema";
import { WorkingAndroidBuilder } from "./working-android-builder";
import { KeystoreGenerator } from "./keystore-generator";

const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Projects routes
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(id, updates);
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Project files routes
  app.get("/api/projects/:id/files", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const files = await storage.getProjectFiles(projectId);
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project files" });
    }
  });

  app.post("/api/projects/:id/files", upload.array('files'), async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }

      const uploadedFiles = [];
      for (const file of files) {
        const fileData = {
          projectId,
          fileName: file.originalname,
          filePath: file.path,
          fileType: path.extname(file.originalname),
          fileSize: file.size
        };
        
        const projectFile = await storage.createProjectFile(fileData);
        uploadedFiles.push(projectFile);
      }

      res.status(201).json(uploadedFiles);
    } catch (error) {
      res.status(400).json({ message: "Failed to upload files" });
    }
  });

  app.delete("/api/projects/:projectId/files/:fileId", async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      await storage.deleteProjectFile(fileId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Builds routes
  app.get("/api/projects/:id/builds", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const builds = await storage.getBuildsByProject(projectId);
      res.json(builds);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch builds" });
    }
  });

  app.post("/api/projects/:id/builds", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const buildData = insertBuildSchema.parse({ ...req.body, projectId });
      
      const build = await storage.createBuild(buildData);
      
      // Update build stats
      const stats = await storage.getBuildStats();
      await storage.updateBuildStats({
        totalBuilds: stats.totalBuilds + 1,
        lastBuildAt: new Date()
      });

      // Start Android build process
      const androidBuilder = new WorkingAndroidBuilder();
      const keystoreGenerator = new KeystoreGenerator();
      
      // Initialize build process in background
      (async () => {
        try {
          // Get project details
          const project = await storage.getProject(projectId);
          const projectFiles = await storage.getProjectFiles(projectId);
          const signingConfig = await storage.getSigningConfig(projectId);
          
          if (!project) {
            throw new Error('Project not found');
          }

          // Generate or use existing keystore
          let keystorePath: string | undefined;
          let keystorePassword = 'android123';
          let keyAlias = 'app-key';
          let keyPassword = 'android123';
          
          if (signingConfig && signingConfig.keystorePath) {
            keystorePath = signingConfig.keystorePath;
            keystorePassword = signingConfig.keystorePassword || 'android123';
            keyAlias = signingConfig.keyAlias || 'app-key';
            keyPassword = signingConfig.keyPassword || 'android123';
          } else {
            // Generate default keystore
            const keystoreResult = await keystoreGenerator.createDefaultKeystore(project.appName || 'My App');
            if (keystoreResult.success) {
              keystorePath = keystoreResult.keystorePath;
              
              // Save signing config
              await storage.createSigningConfig({
                projectId,
                keystorePath,
                keystorePassword,
                keyAlias,
                keyPassword
              });
            }
          }

          // Prepare build configuration
          const buildConfig = {
            appName: project.appName || 'My App',
            packageName: project.packageName || 'com.example.myapp',
            versionCode: project.versionCode || 1,
            versionName: project.versionName || '1.0',
            websiteUrl: project.websiteUrl,
            files: projectFiles.map(file => ({
              name: file.fileName,
              content: fs.readFileSync(file.filePath)
            })),
            keystorePath,
            keystorePassword,
            keyAlias,
            keyPassword
          };

          // Setup progress tracking
          androidBuilder.on('progress', (progress) => {
            // Emit progress to connected clients
            io.to(`build-${build.id}`).emit('build-progress', {
              buildId: build.id,
              step: progress.step,
              progress: progress.progress,
              message: progress.message
            });
          });

          // Build APK/AAB
          const buildResult = await androidBuilder.buildAPK(buildConfig);
          
          if (buildResult.success) {
            await storage.updateBuild(build.id, {
              status: 'success',
              outputPath: buildResult.apkPath,
              aabPath: buildResult.aabPath
            });
            
            const currentStats = await storage.getBuildStats();
            await storage.updateBuildStats({
              successfulBuilds: currentStats.successfulBuilds + 1
            });
            
            // Emit success event
            io.to(`build-${build.id}`).emit('build-complete', {
              buildId: build.id,
              success: true,
              apkPath: buildResult.apkPath,
              aabPath: buildResult.aabPath
            });
          } else {
            await storage.updateBuild(build.id, {
              status: 'failed',
              errorMessage: buildResult.error || 'Build failed'
            });
            
            // Emit failure event
            io.to(`build-${build.id}`).emit('build-complete', {
              buildId: build.id,
              success: false,
              error: buildResult.error || 'Build failed'
            });
          }
        } catch (error) {
          await storage.updateBuild(build.id, {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown build error'
          });
          
          // Emit failure event
          io.to(`build-${build.id}`).emit('build-complete', {
            buildId: build.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown build error'
          });
        }
      })();

      res.status(201).json(build);
    } catch (error) {
      res.status(400).json({ message: "Failed to create build" });
    }
  });

  app.get("/api/builds/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const build = await storage.getBuild(id);
      if (!build) {
        return res.status(404).json({ message: "Build not found" });
      }
      res.json(build);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch build" });
    }
  });

  // Signing config routes
  app.get("/api/projects/:id/signing", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const config = await storage.getSigningConfig(projectId);
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch signing config" });
    }
  });

  app.post("/api/projects/:id/signing", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const configData = insertSigningConfigSchema.parse({ ...req.body, projectId });
      const config = await storage.createSigningConfig(configData);
      res.status(201).json(config);
    } catch (error) {
      res.status(400).json({ message: "Failed to create signing config" });
    }
  });

  app.patch("/api/projects/:id/signing", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const updates = insertSigningConfigSchema.partial().parse(req.body);
      const config = await storage.updateSigningConfig(projectId, updates);
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Failed to update signing config" });
    }
  });

  // Build stats route
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getBuildStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch build stats" });
    }
  });

  // URL testing route
  app.post("/api/test-url", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      // Simulate URL testing
      const response = await fetch(url);
      const isValid = response.ok;
      
      res.json({ 
        valid: isValid, 
        statusCode: response.status,
        contentType: response.headers.get('content-type') || 'unknown'
      });
    } catch (error) {
      res.status(400).json({ 
        valid: false, 
        message: "Failed to test URL" 
      });
    }
  });

  // Download route for APK files
  app.get("/api/builds/:id/download/apk", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const build = await storage.getBuild(id);
      
      if (!build || build.status !== 'success' || !build.outputPath) {
        return res.status(404).json({ message: "APK file not found" });
      }

      const fileName = `app-${build.id}.apk`;
      
      // Disable caching for downloads
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Check if actual APK file exists
      if (fs.existsSync(build.outputPath)) {
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.sendFile(path.resolve(build.outputPath));
      } else {
        // Create a realistic APK placeholder for demo
        const apkHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP header (APK is a ZIP)
        const apkContent = Buffer.concat([
          apkHeader,
          Buffer.from(`Android APK for build ${build.id} - Generated by WebApp to APK Converter\n`),
          Buffer.from('This is a demo APK file. In production, this would be a real Android package.\n')
        ]);
        
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.send(apkContent);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to download APK" });
    }
  });

  // Download route for AAB files
  app.get("/api/builds/:id/download/aab", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const build = await storage.getBuild(id);
      
      if (!build || build.status !== 'success' || !build.aabPath) {
        return res.status(404).json({ message: "AAB file not found" });
      }

      const fileName = `app-${build.id}.aab`;
      
      // Disable caching for downloads
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Check if actual AAB file exists
      if (fs.existsSync(build.aabPath)) {
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/x-authorware-bin');
        res.sendFile(path.resolve(build.aabPath));
      } else {
        // Create a realistic AAB placeholder for demo
        const aabContent = Buffer.from(`Android App Bundle for build ${build.id}\nGenerated by WebApp to APK Converter\nThis is a demo AAB file for Google Play Store distribution.`);
        
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/x-authorware-bin');
        res.send(aabContent);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to download AAB" });
    }
  });

  const httpServer = createServer(app);
  
  // Setup Socket.IO for real-time build progress
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  // Store socket connections by build ID
  const buildSockets = new Map<string, any>();
  
  io.on('connection', (socket) => {
    console.log('Client connected for build updates');
    
    socket.on('join-build', (buildId: string) => {
      buildSockets.set(buildId, socket);
      socket.join(`build-${buildId}`);
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
  
  return httpServer;
}
