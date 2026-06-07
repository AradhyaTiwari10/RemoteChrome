import Docker from "dockerode";

export class DockerService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  /**
   * Creates a browser agent container
   */
  async createContainer(sessionId: string, targetUrl: string): Promise<string> {
    try {
      const container = await this.docker.createContainer({
        Image: "remotechrome-browser:latest",
        name: `browserpilot-session-${sessionId}`,
        Env: [
          `SESSION_ID=${sessionId}`,
          `TARGET_URL=${targetUrl}`
        ],
        HostConfig: {
          NetworkMode: "browserpilot-net"
        }
      });
      return container.id;
    } catch (error: any) {
      throw new Error(`Docker container creation failed: ${error.message}`);
    }
  }

  /**
   * Starts a created container
   */
  async startContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
    } catch (error: any) {
      throw new Error(`Docker container start failed: ${error.message}`);
    }
  }

  /**
   * Stops a running container
   */
  async stopContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
    } catch (error: any) {
      // Ignore if container is already stopped/dead
      if (error.statusCode !== 304 && error.statusCode !== 404) {
        throw new Error(`Docker container stop failed: ${error.message}`);
      }
    }
  }

  /**
   * Removes a container from the host
   */
  async removeContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force: true });
    } catch (error: any) {
      if (error.statusCode !== 404) {
        throw new Error(`Docker container removal failed: ${error.message}`);
      }
    }
  }

  /**
   * Lists all containers
   */
  async listContainers(): Promise<Docker.ContainerInfo[]> {
    try {
      return await this.docker.listContainers({ all: true });
    } catch (error: any) {
      throw new Error(`Docker container list failed: ${error.message}`);
    }
  }

  /**
   * Inspects a specific container
   */
  async inspectContainer(containerId: string): Promise<Docker.ContainerInspectInfo> {
    try {
      const container = this.docker.getContainer(containerId);
      return await container.inspect();
    } catch (error: any) {
      throw new Error(`Docker container inspect failed: ${error.message}`);
    }
  }
}
