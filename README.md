# 暗盘练习生

一个使用真实港股 IPO 最终暗盘结果、固定种子模拟盘中路径的匿名交易训练原型。

## 本地运行

```bash
npm install
npm run dev
```

## 校验与构建

```bash
npm test
npm run build
```

## 更新案例数据

```bash
npm run refresh:data
```

刷新脚本从 `hkipo-stock-api` 读取最近三个月的已上市 IPO，并按强势、温和上涨、破发和平台分歧规则选取 10 个案例。刷新失败时，网页仍使用已固化在 `src/data/ipo-cases.json` 的数据。


