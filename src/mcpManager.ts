import { EventEmitter } from 'events';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import path from 'path';

const MCP_CONFIG_PATH = path.join(__dirname, '../config/mcpServers.json');

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpServers {
  [name: string]: McpServerConfig;
}

export interface McpConfigFile {
  mcpServers: McpServers;
}

export class McpManager extends EventEmitter {
  private servers: McpServers = {};
  private processes: Record<string, ChildProcessWithoutNullStreams> = {};

  constructor() {
    super();
    this.loadConfigs();
  }

  loadConfigs() {
    if (fs.existsSync(MCP_CONFIG_PATH)) {
      const raw = fs.readFileSync(MCP_CONFIG_PATH, 'utf-8');
      const parsed: McpConfigFile = JSON.parse(raw);
      this.servers = parsed.mcpServers || {};
    } else {
      this.servers = {};
    }
  }

  saveConfigs() {
    const data: McpConfigFile = { mcpServers: this.servers };
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  }

  listServers(): McpServers {
    return { ...this.servers };
  }

  addServer(name: string, config: McpServerConfig) {
    this.servers[name] = config;
    this.saveConfigs();
    this.emit('servers-updated', this.listServers());
  }

  removeServer(name: string) {
    delete this.servers[name];
    this.saveConfigs();
    this.emit('servers-updated', this.listServers());
  }

  launchServer(name: string): boolean {
    const config = this.servers[name];
    if (!config) return false;
    if (this.processes[name]) return false; // Already running
    const proc = spawn(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: 'pipe',
    });
    this.processes[name] = proc;
    proc.stdout.on('data', (data) => {
      this.emit('server-stdout', name, data.toString());
    });
    proc.stderr.on('data', (data) => {
      this.emit('server-stderr', name, data.toString());
    });
    proc.on('close', (code) => {
      this.emit('server-exit', name, code);
      delete this.processes[name];
    });
    return true;
  }

  sendToServer(name: string, message: string): boolean {
    const proc = this.processes[name];
    if (!proc) return false;
    proc.stdin.write(message + '\n');
    return true;
  }

  stopServer(name: string): boolean {
    const proc = this.processes[name];
    if (!proc) return false;
    proc.kill();
    return true;
  }
}

export const mcpManager = new McpManager(); 