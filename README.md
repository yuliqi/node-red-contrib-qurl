# node-red-contrib-qurl

**qurl 节点** 是一个基于 **Axios** 的 HTTP/HTTPS 请求节点，支持 Node-RED 流程中灵活的网络请求。  
可通过节点配置或消息动态控制请求，还支持将请求函数注入消息 (`msg.qurl`) 以异步调用。

---

## 🌟 特性

- 支持 HTTP 方法：GET / POST / PUT / DELETE / PATCH / HEAD  
- 支持自定义请求头和 URL 参数  
- 支持 keep-alive 复用 TCP 连接  
- 支持 JSON、文本、ArrayBuffer 响应  
- 可选择**直接请求**或**注入异步函数 `msg.qurl()`**  
- 兼容 Axios 配置语法，支持 async/await 调用  

---

## ⚡ 安装

```bash
cd ~/.node-red
npm install node-red-contrib-qurl
````

> 安装完成后重启 Node-RED。

---

## 🧩 节点属性

| 属性                           | 说明                                                            |
| ---------------------------- | ------------------------------------------------------------- |
| **名称 (name)**                | 节点名称，可选。                                                      |
| **端点配置 (endpoint)**          | 引用 `qurl-config` 配置节点，包含 baseURL、证书、代理等信息。                    |
| **请求方法 (method)**            | GET / POST / PUT / DELETE / PATCH / HEAD，或 “用 msg.method 设定”。 |
| **请求路径 (url)**               | 请求路径，可动态覆盖（`msg.url`）。                                        |
| **响应类型 (responseType)**      | JSON / text / arraybuffer。                                    |
| **保持连接 (keepAlive)**         | 启用 TCP keep-alive。                                            |
| **超时时间 (timeout)**           | 毫秒为单位。                                                        |
| **请求头 (headers)**            | 自定义请求头。                                                       |
| **详细输出 (verboseOut)**        | 输出完整响应对象，包括状态码和头信息。                                           |
| **通过 msg.qurl 执行 (useQurl)** | 启用后节点不直接请求，而是注入 `msg.qurl()` 函数，由 Function 节点调用。              |

---

## 💬 消息属性

| 属性            | 说明                            |
| ------------- | ----------------------------- |
| `msg.payload` | 请求体数据（POST/PUT/PATCH/DELETE）。 |
| `msg.params`  | URL 查询参数，可覆盖节点配置。             |
| `msg.headers` | 请求头，可覆盖节点配置。                  |
| `msg.url`     | 动态覆盖节点 URL。                   |
| `msg.method`  | 当请求方法为 “use” 时，通过此字段设置实际方法。   |
| `msg.qurl`    | 当启用“通过 msg.qurl 执行”时注入的异步函数。  |

---

## 🏃 使用示例

### 1️⃣ 普通请求模式（默认）

```javascript
msg.method = "get";
msg.url = "/users/1";
return msg;
```

节点会直接发起请求，返回 `msg.payload` 或详细响应（视 verboseOut 设置）。

---

### 2️⃣ 通过 msg.qurl 执行模式

勾选 **通过 msg.qurl 执行** 后，节点不会直接请求，而是注入异步函数。

```javascript
const { qurl } = msg;

try {
    const res = await qurl({
        method: "post",
        url: "/users",
        data: { name: "Alice" },
        params: { debug: true },
        headers: { "X-Auth": "token" }
    });

    msg.payload = res.data;
    return [msg, null];
} catch (err) {
    msg.error = err;
    return [null, msg];
}
```

> 💡 支持 async/await，参数与 Axios 配置完全兼容。

---

## 🔧 节点状态

| 状态       | 含义         |
| -------- | ---------- |
| 🟢 green | 上次请求成功     |
| 🔵 blue  | 节点正在执行请求   |
| 🔴 red   | 请求失败或配置错误  |
| s        | 成功请求计数     |
| err      | 错误请求计数     |
| rt       | 上次请求耗时（ms） |

---

## ⚠️ 注意事项

* 若启用 `useQurl`，节点只注入函数，不执行请求。
* 建议为每个请求设置合理超时，避免流程阻塞。
* 响应类型为 `stream` 时返回 `Readable` 对象，可用于文件写入或转发。
* `msg.qurl` 支持多次调用，互不干扰，可灵活用于事务或异步控制。
* 配合 Function、Switch、Catch、Status 节点可实现复杂流程控制。

---

## 📦 依赖

* [axios](https://www.npmjs.com/package/axios)
* Node.js ≥ 14
* Node-RED ≥ 3.0

---

## 🔗 参考

* [Axios 官方文档](https://axios-http.com/)
* [Node-RED 官方节点开发文档](https://nodered.org/docs/creating-nodes/)

---

## 📝 许可证

MIT License