APP_NAME ?= llmmask
IMAGE ?= llmmask-server:latest
GOCACHE ?= $(CURDIR)/.cache/go-build

.PHONY: build build-backend docker-image clean

build: build-backend

build-backend:
	mkdir -p "$(GOCACHE)" bin
	GOCACHE="$(GOCACHE)" go build -o bin/$(APP_NAME) ./src/main.go

docker-image:
	docker build -t $(IMAGE) .

clean:
	rm -rf bin .cache
