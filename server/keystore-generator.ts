import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

export interface KeystoreConfig {
  alias: string;
  password: string;
  keystorePassword: string;
  dname: string;
  validity: number;
}

export interface KeystoreResult {
  success: boolean;
  keystorePath?: string;
  error?: string;
}

export class KeystoreGenerator {
  private keystoreDir: string;

  constructor() {
    this.keystoreDir = path.join(process.cwd(), 'keystores');
    if (!fs.existsSync(this.keystoreDir)) {
      fs.mkdirSync(this.keystoreDir, { recursive: true });
    }
  }

  async generateKeystore(config: KeystoreConfig): Promise<KeystoreResult> {
    const keystoreId = nanoid();
    const keystorePath = path.join(this.keystoreDir, `${keystoreId}.jks`);
    
    try {
      // Generate keystore using keytool
      const keytoolCommand = [
        'keytool',
        '-genkeypair',
        '-v',
        '-keystore', keystorePath,
        '-alias', config.alias,
        '-keyalg', 'RSA',
        '-keysize', '2048',
        '-validity', config.validity.toString(),
        '-storepass', config.keystorePassword,
        '-keypass', config.password,
        '-dname', config.dname
      ].join(' ');
      
      execSync(keytoolCommand, { 
        stdio: 'pipe',
        timeout: 60000 // 1 minute timeout
      });
      
      if (!fs.existsSync(keystorePath)) {
        throw new Error('Keystore file not generated');
      }
      
      return {
        success: true,
        keystorePath
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown keystore generation error'
      };
    }
  }

  async createDefaultKeystore(appName: string): Promise<KeystoreResult> {
    const config: KeystoreConfig = {
      alias: 'app-key',
      password: 'android123',
      keystorePassword: 'android123',
      dname: `CN=${appName}, OU=Mobile, O=Company, L=City, ST=State, C=US`,
      validity: 10000 // ~27 years
    };
    
    return this.generateKeystore(config);
  }

  getKeystorePath(keystoreId: string): string {
    return path.join(this.keystoreDir, `${keystoreId}.jks`);
  }
}