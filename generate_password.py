import bcrypt

# 生成密码哈希
password = "@#Gfl3068690"
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
print(f"密码: {password}")
print(f"哈希值: {hashed.decode()}")
