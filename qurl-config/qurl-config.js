module.exports = function (RED) {
    class EndpointNode {
        constructor(config) {
            RED.nodes.createNode(this, config);
            this.config = { ...config }; // 保存节点配置，方便后续使用
        }
    }

    RED.nodes.registerType("qurl-config", EndpointNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" },
            bearerToken: { type: "password" },
            proxyUsername: { type: "text" },
            proxyPassword: { type: "password" },
            apiKeyValue: { type: "text" },
        },
    });
};
