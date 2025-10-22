import { expect } from "chai";
import { BlockscoutMonitorService } from "../services/BlockscoutMonitorService";
import { BlockscoutMCPService } from "../services/BlockscoutMCPService";
import { MCPApplication } from "../services/MCPApplication";

describe("Blockscout Integration", function () {
  let monitorService: BlockscoutMonitorService;
  let mcpService: BlockscoutMCPService;
  let mcpApplication: MCPApplication;

  beforeEach(async function () {
    monitorService = new BlockscoutMonitorService(
      "https://eth-sepolia.blockscout.com/api",
      "https://eth-sepolia.blockscout.com",
      "https://autoscout.example.com"
    );
    
    mcpService = new BlockscoutMCPService(
      "http://localhost:3000",
      "test-api-key"
    );
    
    mcpApplication = new MCPApplication(mcpService);
  });

  describe("BlockscoutMonitorService", function () {
    it("Should initialize successfully", function () {
      const config = monitorService.getServiceConfig();
      expect(config.apiUrl).to.equal("https://eth-sepolia.blockscout.com/api");
      expect(config.rpcUrl).to.equal("https://eth-sepolia.blockscout.com");
      expect(config.autoscoutUrl).to.equal("https://autoscout.example.com");
    });

    it("Should add and remove contracts", function () {
      const chainId = 1;
      const contractAddress = "0x1234567890123456789012345678901234567890";
      const contractName = "TestContract";

      monitorService.addContract(chainId, contractAddress, contractName);
      
      const status = monitorService.getMonitoringStatus();
      expect(status.monitoredContracts).to.equal(1);
      expect(status.chains).to.include(chainId);

      monitorService.removeContract(chainId, contractAddress);
      
      const newStatus = monitorService.getMonitoringStatus();
      expect(newStatus.monitoredContracts).to.equal(0);
    });

    it("Should index events", function () {
      const chainId = 1;
      const contractAddress = "0x1234567890123456789012345678901234567890";
      const contractName = "TestContract";

      monitorService.addContract(chainId, contractAddress, contractName);
      
      const events = [
        { type: "DepositReceived", data: { amount: 1000 } },
        { type: "ActivationProcessed", data: { activationId: 1 } }
      ];

      expect(() => {
        monitorService.indexAvailEvents(chainId, contractAddress, events);
      }).to.not.throw();

      const indexedEvents = monitorService.getContractEvents(chainId, contractAddress);
      expect(indexedEvents).to.have.length(2);
    });

    it("Should export all events", function () {
      const chainId = 1;
      const contractAddress = "0x1234567890123456789012345678901234567890";
      const contractName = "TestContract";

      monitorService.addContract(chainId, contractAddress, contractName);
      
      const events = [{ type: "TestEvent", data: {} }];
      monitorService.indexAvailEvents(chainId, contractAddress, events);

      const exportData = monitorService.exportAllEvents();
      expect(exportData).to.have.property('timestamp');
      expect(exportData).to.have.property('monitoredContracts');
      expect(exportData).to.have.property('events');
    });

    it("Should clear contract events", function () {
      const chainId = 1;
      const contractAddress = "0x1234567890123456789012345678901234567890";
      const contractName = "TestContract";

      monitorService.addContract(chainId, contractAddress, contractName);
      
      const events = [{ type: "TestEvent", data: {} }];
      monitorService.indexAvailEvents(chainId, contractAddress, events);

      let indexedEvents = monitorService.getContractEvents(chainId, contractAddress);
      expect(indexedEvents).to.have.length(1);

      monitorService.clearContractEvents(chainId, contractAddress);
      
      indexedEvents = monitorService.getContractEvents(chainId, contractAddress);
      expect(indexedEvents).to.have.length(0);
    });
  });

  describe("BlockscoutMCPService", function () {
    it("Should initialize successfully", function () {
      const status = mcpService.getServiceStatus();
      expect(status.mcpServerUrl).to.equal("http://localhost:3000");
      expect(status.hasApiKey).to.be.true;
      expect(status.availableTools).to.be.greaterThan(0);
    });

    it("Should have available tools", function () {
      const tools = mcpService.getAvailableTools();
      expect(tools).to.be.an('array');
      expect(tools.length).to.be.greaterThan(0);
    });

    it("Should get tool details", function () {
      const toolDetails = mcpService.getToolDetails('get_address_info');
      expect(toolDetails).to.have.property('name');
      expect(toolDetails).to.have.property('description');
      expect(toolDetails).to.have.property('parameters');
    });

    it("Should create activation audit prompt", function () {
      const prompt = mcpService.createActivationAuditPrompt();
      expect(prompt).to.be.a('string');
      expect(prompt).to.include('XMBL Token Activation Audit');
      expect(prompt).to.include('Sequential Processing Analysis');
    });

    it("Should get MCP configuration", function () {
      const config = mcpService.getMCPConfig();
      expect(config).to.have.property('serverUrl');
      expect(config).to.have.property('tools');
      expect(config).to.have.property('capabilities');
      expect(config.capabilities).to.include('blockchain_analysis');
    });

    it("Should set API key", function () {
      const newApiKey = "new-test-api-key";
      mcpService.setApiKey(newApiKey);
      
      const status = mcpService.getServiceStatus();
      expect(status.hasApiKey).to.be.true;
    });
  });

  describe("MCPApplication", function () {
    it("Should initialize successfully", function () {
      const status = mcpApplication.getApplicationStatus();
      expect(status).to.have.property('mcpConnected');
      expect(status).to.have.property('conversationCount');
      expect(status).to.have.property('lastActivity');
      expect(status).to.have.property('capabilities');
    });

    it("Should process queries", async function () {
      const query = "Analyze activation sequence for anomalies";
      const context = { chainId: 1, contractAddress: "0x1234" };
      
      const result = await mcpApplication.processQuery(query, context);
      expect(result).to.have.property('response');
      expect(result).to.have.property('analysis');
      expect(result).to.have.property('recommendations');
      expect(result.response).to.be.a('string');
    });

    it("Should maintain conversation history", async function () {
      const query = "What is the current activation status?";
      
      const result = await mcpApplication.processQuery(query);
      
      // Check that we got a response (even if it's an error response)
      expect(result).to.have.property('response');
      expect(result).to.have.property('analysis');
      expect(result).to.have.property('recommendations');
      
      // Wait a bit for the conversation to be stored
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const history = mcpApplication.getConversationHistory();
      expect(history).to.have.length(1);
      expect(history[0].user).to.equal(query);
      expect(history[0].assistant).to.be.a('string');
    });

    it("Should clear conversation history", async function () {
      await mcpApplication.processQuery("Test query");
      
      let history = mcpApplication.getConversationHistory();
      expect(history).to.have.length(1);
      
      mcpApplication.clearHistory();
      
      history = mcpApplication.getConversationHistory();
      expect(history).to.have.length(0);
    });

    it("Should export conversation data", async function () {
      await mcpApplication.processQuery("Test query");
      
      const exportData = mcpApplication.exportConversationData();
      expect(exportData).to.have.property('timestamp');
      expect(exportData).to.have.property('totalConversations');
      expect(exportData).to.have.property('conversations');
      expect(exportData).to.have.property('mcpConfig');
    });

    it("Should get activation auditor interface", async function () {
      const interfaceData = await mcpApplication.getActivationAuditorInterface();
      expect(interfaceData).to.have.property('prompt');
      expect(interfaceData).to.have.property('tools');
      expect(interfaceData).to.have.property('examples');
      expect(interfaceData.examples).to.be.an('array');
      expect(interfaceData.examples.length).to.be.greaterThan(0);
    });

    it("Should handle different query types", async function () {
      const queries = [
        "Analyze activation sequence",
        "Check price oracle status",
        "Get transaction details",
        "Find address information",
        "Detect anomalies"
      ];
      
      for (const query of queries) {
        const result = await mcpApplication.processQuery(query);
        expect(result.response).to.be.a('string');
        expect(result.response.length).to.be.greaterThan(0);
      }
    });
  });
});
