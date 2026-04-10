# tg-bridge
开源的web端与telegram双向桥接机制<br>
Fennec浏览器效果<br>
![图片1](https://raw.githubusercontent.com/hepsa2/tg-bridge/main/set/c1.jpg)
## 功能实现
- 登陆页面显示3秒高清壁纸
- 桥接私密/公开群组/联系人
- 实时桥接消息
- 网页端可发内容到频道
## 优势
- 无需租用服务器托管，享cloudflare免费套餐即可
- 手机即可部署
- 页面极简风格
- 使用tor网桥也可轻松“上tg”
- 实测封bot概率较低
## 使用说明
- 需要将telegram机器人拉入指定群组/频道
- 需要给机器人添加群组/频道管理权限
- 群组中发送/getid以获取群组id,后在worker修改配置
- 联系人需手动给bot发送/start并把自己的id给机器人管理,以在cfworker配置id
- 注意：telegram消息转网页端延迟相对较高
## 部署

[查看部署教程](https://github.com/hepsa2/tg-bridge/main/set/set.md)
