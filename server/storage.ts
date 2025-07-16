import { 
  users, 
  projects, 
  builds, 
  projectFiles, 
  signingConfigs, 
  buildStats,
  type User, 
  type InsertUser,
  type Project,
  type InsertProject,
  type Build,
  type InsertBuild,
  type ProjectFile,
  type InsertProjectFile,
  type SigningConfig,
  type InsertSigningConfig,
  type BuildStats
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Project methods
  getProject(id: number): Promise<Project | undefined>;
  getProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;
  
  // Build methods
  getBuild(id: number): Promise<Build | undefined>;
  getBuildsByProject(projectId: number): Promise<Build[]>;
  createBuild(build: InsertBuild): Promise<Build>;
  updateBuild(id: number, updates: Partial<InsertBuild>): Promise<Build>;
  
  // Project files methods
  getProjectFiles(projectId: number): Promise<ProjectFile[]>;
  createProjectFile(file: InsertProjectFile): Promise<ProjectFile>;
  deleteProjectFile(id: number): Promise<void>;
  
  // Signing config methods
  getSigningConfig(projectId: number): Promise<SigningConfig | undefined>;
  createSigningConfig(config: InsertSigningConfig): Promise<SigningConfig>;
  updateSigningConfig(projectId: number, updates: Partial<InsertSigningConfig>): Promise<SigningConfig>;
  
  // Build stats methods
  getBuildStats(): Promise<BuildStats>;
  updateBuildStats(updates: Partial<BuildStats>): Promise<BuildStats>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private projects: Map<number, Project> = new Map();
  private builds: Map<number, Build> = new Map();
  private projectFiles: Map<number, ProjectFile> = new Map();
  private signingConfigs: Map<number, SigningConfig> = new Map();
  private buildStats: BuildStats = {
    id: 1,
    totalBuilds: 0,
    successfulBuilds: 0,
    failedBuilds: 0,
    lastBuildAt: null
  };
  
  private userIdCounter = 1;
  private projectIdCounter = 1;
  private buildIdCounter = 1;
  private fileIdCounter = 1;
  private signingConfigIdCounter = 1;

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Project methods
  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.projectIdCounter++;
    const now = new Date();
    const project: Project = { 
      ...insertProject, 
      id, 
      createdAt: now, 
      updatedAt: now,
      version: insertProject.version || "1.0.0",
      versionCode: insertProject.versionCode || 1,
      description: insertProject.description || null,
      websiteUrl: insertProject.websiteUrl || null,
      iconPath: insertProject.iconPath || null,
      logoPath: insertProject.logoPath || null
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project> {
    const project = this.projects.get(id);
    if (!project) throw new Error("Project not found");
    
    const updatedProject = { 
      ...project, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: number): Promise<void> {
    this.projects.delete(id);
    // Clean up related data
    Array.from(this.builds.values())
      .filter(build => build.projectId === id)
      .forEach(build => this.builds.delete(build.id));
    Array.from(this.projectFiles.values())
      .filter(file => file.projectId === id)
      .forEach(file => this.projectFiles.delete(file.id));
    Array.from(this.signingConfigs.values())
      .filter(config => config.projectId === id)
      .forEach(config => this.signingConfigs.delete(config.id));
  }

  // Build methods
  async getBuild(id: number): Promise<Build | undefined> {
    return this.builds.get(id);
  }

  async getBuildsByProject(projectId: number): Promise<Build[]> {
    return Array.from(this.builds.values())
      .filter(build => build.projectId === projectId)
      .sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime());
  }

  async createBuild(insertBuild: InsertBuild): Promise<Build> {
    const id = this.buildIdCounter++;
    const now = new Date();
    const build: Build = { 
      ...insertBuild, 
      id, 
      startedAt: now, 
      completedAt: null,
      outputPath: insertBuild.outputPath || null,
      aabPath: insertBuild.aabPath || null,
      errorMessage: insertBuild.errorMessage || null
    };
    this.builds.set(id, build);
    return build;
  }

  async updateBuild(id: number, updates: Partial<InsertBuild>): Promise<Build> {
    const build = this.builds.get(id);
    if (!build) throw new Error("Build not found");
    
    const updatedBuild = { ...build, ...updates };
    if (updates.status === 'success' || updates.status === 'failed') {
      updatedBuild.completedAt = new Date();
    }
    this.builds.set(id, updatedBuild);
    return updatedBuild;
  }

  // Project files methods
  async getProjectFiles(projectId: number): Promise<ProjectFile[]> {
    return Array.from(this.projectFiles.values())
      .filter(file => file.projectId === projectId);
  }

  async createProjectFile(insertFile: InsertProjectFile): Promise<ProjectFile> {
    const id = this.fileIdCounter++;
    const now = new Date();
    const file: ProjectFile = { 
      ...insertFile, 
      id, 
      uploadedAt: now 
    };
    this.projectFiles.set(id, file);
    return file;
  }

  async deleteProjectFile(id: number): Promise<void> {
    this.projectFiles.delete(id);
  }

  // Signing config methods
  async getSigningConfig(projectId: number): Promise<SigningConfig | undefined> {
    return Array.from(this.signingConfigs.values())
      .find(config => config.projectId === projectId);
  }

  async createSigningConfig(insertConfig: InsertSigningConfig): Promise<SigningConfig> {
    const id = this.signingConfigIdCounter++;
    const now = new Date();
    const config: SigningConfig = { 
      ...insertConfig, 
      id, 
      createdAt: now 
    };
    this.signingConfigs.set(id, config);
    return config;
  }

  async updateSigningConfig(projectId: number, updates: Partial<InsertSigningConfig>): Promise<SigningConfig> {
    const config = Array.from(this.signingConfigs.values())
      .find(c => c.projectId === projectId);
    if (!config) throw new Error("Signing config not found");
    
    const updatedConfig = { ...config, ...updates };
    this.signingConfigs.set(config.id, updatedConfig);
    return updatedConfig;
  }

  // Build stats methods
  async getBuildStats(): Promise<BuildStats> {
    return { ...this.buildStats };
  }

  async updateBuildStats(updates: Partial<BuildStats>): Promise<BuildStats> {
    this.buildStats = { ...this.buildStats, ...updates };
    return { ...this.buildStats };
  }
}

export const storage = new MemStorage();
