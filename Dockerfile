# Build stage
FROM golang:1.24-alpine AS builder
ARG TARGETOS=linux
ARG TARGETARCH=amd64
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
# Copy everything except desktop-client directory
COPY . .
RUN rm -rf desktop-client
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -o llmmask src/main.go
RUN if [ -d resources ]; then tar -czf resources.tar.gz -C resources .; fi

# Final stage
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/llmmask ./llmmask
COPY --from=builder /app/resources.tar.gz ./resources.tar.gz
RUN if [ -f resources.tar.gz ]; then mkdir resources && tar -xzf resources.tar.gz -C resources && rm resources.tar.gz; fi
EXPOSE 8080
CMD ["./llmmask"]
