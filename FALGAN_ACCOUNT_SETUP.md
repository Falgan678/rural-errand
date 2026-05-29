# Falgan账号设置说明

## 账号信息
- **用户名**: falgan
- **手机号**: 13800138004
- **密码**: @#Gfl3068690
- **位置**: 中村

## 当前状态
falgan账号已在数据库中创建，但密码哈希值需要更新为正确的值。

## 完成密码设置的步骤

### 步骤1：生成密码哈希
访问以下URL来生成正确的密码哈希：
```
https://h6nhqlwf-56a607daa957d74c2bf7816a52d0e9eef331824a.preview.with.woa.com/api/debug/generate-password-hash?password=@%23Gfl3068690
```

注意：URL中的特殊字符需要编码：
- `@` 编码为 `%40`
- `#` 编码为 `%23`

或者直接访问：
```
/api/debug/generate-password-hash?password=@#Gfl3068690
```

这个API会返回类似以下的JSON：
```json
{
  "code": 0,
  "password": "@#Gfl3068690",
  "hash": "$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### 步骤2：更新数据库
复制返回的hash值，然后执行以下SQL更新数据库：

```sql
UPDATE users 
SET password = '这里粘贴上一步获取的hash值' 
WHERE phone = '13800138004';
```

### 步骤3：验证登录
更新完成后，使用以下方式登录测试：

**方式1：用户名登录**
- 用户名：falgan
- 密码：@#Gfl3068690

**方式2：手机号登录**
- 手机号：13800138004
- 密码：@#Gfl3068690

## 快速完成方法

如果你有数据库访问权限，可以直接执行以下步骤：

1. 访问预览链接的密码生成API
2. 复制返回的hash值
3. 在数据库中执行UPDATE语句
4. 测试登录

## 临时解决方案

如果暂时无法更新数据库，可以：
1. 使用其他测试账号（测试用户1-3，密码都是123456）
2. 等待密码哈希生成后再更新数据库

## 安全提示

- `/api/debug/generate-password-hash` 接口仅用于开发环境
- 生产环境应该删除此接口
- 不要在公开环境暴露此接口

---

**创建时间**: 2026-02-09
**版本**: v1.0
