module.exports = function (RED) {
    const axios = require("axios");
    const http = require("http");
    const https = require("https");
    const fs = require("fs");

    function RequestNode(n) {
        RED.nodes.createNode(this, n);
        const node = this;

        const endpoint = RED.nodes.getNode(n.endpoint);

        // --------- Agent 配置 ---------
        const agentConfig = {
            keepAlive: n.keepAlive,
            rejectUnauthorized: endpoint?.config?.rejectUnauthorized ?? true,
        };
        if (endpoint?.config?.caCertPath) {
            try {
                agentConfig.ca = fs.readFileSync(endpoint.config.caCertPath);
            } catch (err) {
                node.error(new Error("CA certificate read error: " + err.message));
            }
        }

        const baseConfig = {
            method: n.method,
            baseURL: endpoint?.config?.baseURL || "",
            timeout: n.timeout || 30000,
            responseType: n.responseType || "json",
            httpsAgent: new https.Agent(agentConfig),
            httpAgent: new http.Agent(agentConfig),
            headers: {},
            params: {},
        };

        // --------- 认证 ---------
        if (endpoint?.credentials?.username && endpoint?.credentials?.password) {
            baseConfig.auth = {
                username: endpoint.credentials.username,
                password: endpoint.credentials.password,
            };
        }

        if (endpoint?.credentials?.bearerToken) {
            baseConfig.headers.Authorization = `Bearer ${endpoint.credentials.bearerToken}`;
        }

        if (n.validateStatus === false) {
            baseConfig.validateStatus = () => true;
        }

        // --------- 代理配置 ---------
        if (endpoint?.proxyEnabled) {
            baseConfig.proxy = {
                protocol: n.proxyProtocol || "http",
                host: n.proxyHost,
                port: n.proxyPort,
            };
            if (endpoint.credentials.proxyUsername && endpoint.credentials.proxyPassword) {
                baseConfig.proxy.auth = {
                    username: endpoint.credentials.proxyUsername,
                    password: endpoint.credentials.proxyPassword,
                };
            }
        }

        // --------- Node 状态和 Metric ---------
        const metric = { execCtr: 0, successCtr: 0, errorCtr: 0, runtime: 0 };
        const updateStatus = (fill) => {
            node.status({
                fill,
                shape: "dot",
                text: `s=${metric.successCtr}, err=${metric.errorCtr}, rt=${metric.runtime}ms`,
            });
        };
        // updateStatus("green");
        node.status({});

        const execStart = () => {
            metric.execCtr++;
            updateStatus("blue");
            return Date.now();
        };

        const execFinish = (startTs, success = true) => {
            metric.execCtr--;
            metric.runtime = Date.now() - startTs;
            if (success) metric.successCtr++; else metric.errorCtr++;
            updateStatus(metric.execCtr > 0 ? "blue" : (success ? "green" : "red"));
        };

        // --------- 辅助函数 ---------
        const getTypedInput = (type, val, msg) => {
            switch (type) {
                case "str": return val;
                case "msg": return msg[val];
                case "flow": return node.context().flow.get(val);
                case "global": return node.context().global.get(val);
                default: return undefined;
            }
        };

        const getProperty = (arr, msg) => {
            if (!Array.isArray(arr)) return {};
            return arr.reduce((acc, el) => {
                acc[getTypedInput(el.keyType, el.keyValue, msg)] =
                    getTypedInput(el.valueType, el.valueValue, msg);
                return acc;
            }, {});
        };

        const resolveApiKey = (value) => {
            const match = /^{{(global|flow)\.(.+)}}$/.exec(value);
            return match ? node.context()[match[1]].get(match[2]) : value;
        };

        // 🔹 --------- 新增 msg.qurl 方法 ---------
        node.createQurlFunction = () => {
            return async function (input) {
                return new Promise(async (resolve, reject) => {
                    try {
                        let methodToUse;
                        if ((input.method || n.method) === "use") {
                            methodToUse = input.method || "get"; // 用传入的 method 或 fallback get
                        } else {
                            methodToUse = input.method || n.method;
                        }

                        const config = { ...baseConfig, url: input.url || n.url, method: methodToUse.toLowerCase() };

                        // GET 参数
                        if ((config.method || 'get').toLowerCase() === "get") {
                            config.params = { ...input.params };
                        } else {
                            config.data = input.data || input.payload;
                            config.params = { ...input.params };
                        }

                        // Headers
                        config.headers = { ...input.headers };

                        // 处理 API Key
                        if (endpoint?.credentials?.apiKeyValue && endpoint?.config?.apiKeyKey && endpoint?.config?.apiKeyAddTo) {
                            const apiKeyValue = resolveApiKey(endpoint.credentials.apiKeyValue);
                            config[endpoint.config.apiKeyAddTo] = {
                                ...(config[endpoint.config.apiKeyAddTo] || {}),
                                [endpoint.config.apiKeyKey]: apiKeyValue,
                            };
                        }

                        const response = await axios.request(config);

                        resolve({
                            payload: response.data,
                            headers: response.headers,
                            statusCode: response.status,
                            responseUrl: response.request?.res?.responseUrl || config.url,
                            redirectList: response.request?._redirectable?.redirects || []
                        });
                    } catch (err) {
                        if (err.response) {
                            resolve({
                                payload: err.response.data,
                                headers: err.response.headers,
                                statusCode: err.response.status
                            });
                        } else {
                            reject(err);
                        }
                    }
                });
            };
        };

        // --------- 输入事件处理 ---------
        node.on("input", async (msg, send, done) => {

            if (n.useQurl ?? true){
                // 挂载同步调用方法
                msg.qurl = node.createQurlFunction();
                return send(msg);
            }

            const startTs = execStart();

            try {
                const config = { ...baseConfig, url: msg.url || n.url, params: {} };

                // 处理 API Key
                if (endpoint?.credentials?.apiKeyValue && endpoint?.config?.apiKeyKey && endpoint?.config?.apiKeyAddTo) {
                    const apiKeyValue = resolveApiKey(endpoint.credentials.apiKeyValue);
                    config[endpoint.config.apiKeyAddTo] = {
                        ...(config[endpoint.config.apiKeyAddTo] || {}),
                        [endpoint.config.apiKeyKey]: apiKeyValue,
                    };
                }

                // 合并 params / headers / data
                if (config.method.toLowerCase() === "get") {
                    config.params = { ...msg.params, ...msg.payload, ...getProperty(n.params, msg) };
                } else {
                    config.data = msg.payload;
                    config.params = { ...msg.params, ...getProperty(n.params, msg) };
                }

                config.headers = { ...msg.headers, ...getProperty(n.headers, msg), ...config.headers };

                const response = await axios.request(config);

                msg.payload = response.data;
                if (n.verboseOut ?? true) {
                    msg.statusCode = response.status;
                    msg.headers = response.headers;
                    msg.responseUrl = response.request?.res?.responseUrl || config.url;
                    msg.redirectList = response.request?._redirectable?.redirects || [];
                } else {
                    delete msg.url;
                    delete msg.params;
                    delete msg.headers;
                }

                send(msg);
                execFinish(startTs, true);
                done();
            } catch (err) {
                if (err.response) {
                    msg.payload = err.response.data;
                    msg.headers = err.response.headers;
                    msg.statusCode = err.response.status;
                }
                execFinish(startTs, false);
                done(err);
            }
        });
    }

    RED.nodes.registerType("qurl", RequestNode);
};
