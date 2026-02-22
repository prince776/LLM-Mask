FROM golang:1.24-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY src ./src
COPY templates ./templates
COPY resources ./resources
RUN go build -o llmmask-server ./src/main.go

FROM alpine:3.22
WORKDIR /app

COPY --from=builder /app/llmmask-server ./llmmask-server
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/resources ./resources

EXPOSE 8080
CMD ["./llmmask-server"]
