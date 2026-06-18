

# 
# make dev                → 启动开发模式
# 

# 
.PHONY: dev-seed screenshot dev build-and-install build-cli

# 

dev:
	bash env/task/init-osx.sh 2>&1 | tail -5
	npm run dev

build:
	bash env/task/init-osx.sh 2>&1 | tail -5
	npm run build

# 

# 

