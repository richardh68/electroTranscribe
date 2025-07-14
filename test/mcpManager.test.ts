import { McpManager, McpServerConfig } from '../src/mcpManager';
import fs from 'fs';
import { spawn } from 'child_process';

jest.mock('fs');
jest.mock('child_process');

describe('McpManager', () => {
  let mcp: McpManager;
  const configPath = require('path').join(__dirname, '../config/mcpServers.json');
  const sampleConfig: McpServerConfig = {
    command: 'echo',
    args: ['hello'],
    env: { TEST: '1' },
  };

  beforeEach(() => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readFileSync as jest.Mock).mockReset();
    (fs.writeFileSync as jest.Mock).mockReset();
    mcp = new McpManager();
  });

  it('should start with no servers if config does not exist', () => {
    expect(mcp.listServers()).toEqual({});
  });

  it('should add and list a server', () => {
    mcp.addServer('test', sampleConfig);
    expect(mcp.listServers()).toHaveProperty('test');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      expect.stringContaining('test'),
      'utf-8'
    );
  });

  it('should remove a server', () => {
    mcp.addServer('test', sampleConfig);
    mcp.removeServer('test');
    expect(mcp.listServers()).not.toHaveProperty('test');
  });

  it('should load servers from config', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ mcpServers: { test: sampleConfig } })
    );
    const loaded = new McpManager();
    expect(loaded.listServers()).toHaveProperty('test');
  });

  it('should launch a server (mocked)', () => {
    mcp.addServer('test', sampleConfig);
    const mockProc = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      stdin: { write: jest.fn() },
      kill: jest.fn(),
    };
    (spawn as jest.Mock).mockReturnValue(mockProc);
    expect(mcp.launchServer('test')).toBe(true);
    expect(spawn).toHaveBeenCalledWith('echo', ['hello'], expect.any(Object));
  });

  it('should not launch a non-existent server', () => {
    expect(mcp.launchServer('nope')).toBe(false);
  });

  it('should send to a running server (mocked)', () => {
    mcp.addServer('test', sampleConfig);
    const mockProc = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      stdin: { write: jest.fn() },
      kill: jest.fn(),
    };
    (spawn as jest.Mock).mockReturnValue(mockProc);
    mcp.launchServer('test');
    expect(mcp.sendToServer('test', 'hi')).toBe(true);
    expect(mockProc.stdin.write).toHaveBeenCalledWith('hi\n');
  });

  it('should stop a running server (mocked)', () => {
    mcp.addServer('test', sampleConfig);
    const mockProc = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      stdin: { write: jest.fn() },
      kill: jest.fn(),
    };
    (spawn as jest.Mock).mockReturnValue(mockProc);
    mcp.launchServer('test');
    expect(mcp.stopServer('test')).toBe(true);
    expect(mockProc.kill).toHaveBeenCalled();
  });
}); 