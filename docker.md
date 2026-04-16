# 私有版本部署

## 打包并部署

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## 打包

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build
```

## 启动

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d
```
