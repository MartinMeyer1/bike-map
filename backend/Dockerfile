FROM golang:1.24-alpine AS build

WORKDIR /app

# Install git for go mod and clone PocketBase
RUN apk add --no-cache git

# Initialize go module and copy files
COPY go.mod go.sum ./
RUN go mod download

# Copy application source
COPY . .

# Build final binary
RUN go build -tags "sqlite_fts5" -o app .

# --------------------

FROM alpine:latest

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

COPY --from=build /app/app ./main

EXPOSE 8090

ENTRYPOINT ["./main"]
CMD ["serve", "--dir", "/pb_data", "--http", "0.0.0.0:8090"]
