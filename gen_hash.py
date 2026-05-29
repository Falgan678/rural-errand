import bcrypt
password = "@#Gfl3068690"
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
print(hashed.decode())
