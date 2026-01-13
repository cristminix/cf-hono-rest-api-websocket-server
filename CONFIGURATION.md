# Cloudflare Deployment Configuration

## Wrangler Configuration

### Basic Configuration (`wrangler.toml`)

```toml
name = "cf-worker-02"
main = "src/index.ts"
compatibility_date = "2024-11-12"

[env.development]
account_id = ""
workers_dev = true

[env.production]
account_id = ""
route = ""

# Add any additional bindings here
# [[env.production.vars]]
# API_KEY = "your-api-key"

# [[env.production.kv_namespaces]]
# binding = "MY_KV_NAMESPACE"
# id = "your-namespace-id"
```

### Configuration Parameters

#### Core Settings

- **`name`**: The name of your Cloudflare Worker (must be unique within your account)
- **`main`**: Entry point file for your Worker application
- **`compatibility_date`**: Ensures consistent API behavior across Cloudflare platform

#### Environment Configuration

##### Development Environment (`[env.development]`)

- **`account_id`**: Your Cloudflare account identifier (leave empty for local dev)
- **`workers_dev`**: Enables deployment to workers.dev subdomain for testing

##### Production Environment (`[env.production]`)

- **`account_id`**: Your Cloudflare account identifier for production deployment
- **`route`**: Custom domain routing pattern (e.g., "example.com/\*")

### Advanced Configuration Options

#### Environment Variables

```toml
[[env.production.vars]]
API_KEY = "your-api-key"
DATABASE_URL = "your-database-url"
JWT_SECRET = "your-jwt-secret"
```

#### KV Namespaces

```toml
[[env.production.kv_namespaces]]
binding = "MY_KV_NAMESPACE"
id = "your-namespace-id"
preview_id = "your-preview-namespace-id"
```

#### Durable Objects

```toml
[[env.production.durable_objects.bindings]]
name = "MY_DURABLE_OBJECT"
class_name = "MyDurableObject"

[[migrations]]
tag = "v1"
new_classes = ["MyDurableObject"]
```

#### R2 Buckets

```toml
[[env.production.r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket-name"
preview_bucket_name = "my-preview-bucket"
```

#### Service Bindings

```toml
[[env.production.services]]
binding = "MY_SERVICE"
service = "my-other-worker"
environment = "production"
```

## Authentication and Account Setup

### Initial Setup

1. Install Wrangler CLI:

```bash
npm install -g wrangler
```

2. Authenticate with Cloudflare:

```bash
wrangler login
```

3. Obtain your Account ID from the Cloudflare dashboard:
   - Go to dash.cloudflare.com
   - Select your account
   - Copy the Account ID from the right sidebar

### Configuration Steps

#### 1. Update Account ID

Edit `wrangler.toml` and add your account ID:

```toml
[env.production]
account_id = "your-actual-account-id-here"
```

#### 2. Configure Custom Domain (Optional)

If using a custom domain:

```toml
[env.production]
account_id = "your-account-id"
route = "your-domain.com/*"
```

#### 3. Set Environment Variables

Add sensitive data as environment variables:

```bash
wrangler secret put API_KEY
wrangler secret put DATABASE_URL
```

## Deployment Strategies

### Development Deployment

Deploy to a temporary workers.dev subdomain:

```bash
wrangler deploy --env development
```

### Production Deployment

Deploy to production environment:

```bash
wrangler deploy --env production
```

### Direct Deployment

Deploy without specifying environment:

```bash
wrangler deploy
```

## Compatibility Settings

### Latest Compatibility Date

Always use the latest compatibility date for new features:

```toml
compatibility_date = "2024-11-12"
```

### Feature Flags

Enable experimental features:

```toml
[env.production]
compatibility_flags = ["nodejs_compat"]
```

## Resource Limits and Constraints

### Cloudflare Workers Limits

- **Memory**: 128 MB (Standard), 512 MB (Unbound)
- **Execution Time**: 10ms (Standard), 30s (Unbound)
- **Request Size**: 1MB (request), 100MB (response)
- **Concurrency**: Limited by CPU time allocation

### WebSocket Specific Considerations

- **Connection Timeout**: 10 minutes idle timeout
- **Message Size**: 1MB per message limit
- **Connection Limits**: Subject to account limits
- **Memory Usage**: Each connection consumes memory

## Environment-Specific Configurations

### Development Environment

```toml
[env.development]
account_id = ""
workers_dev = true
logpush = false  # Disable for development
```

### Staging Environment

```toml
[env.staging]
account_id = "staging-account-id"
route = "staging.yourdomain.com/*"
logpush = true
```

### Production Environment

```toml
[env.production]
account_id = "production-account-id"
route = "yourdomain.com/*"
logpush = true
tail_consumers = [
  { service = "logging-service" }
]
```

## Security Configuration

### CORS Headers

Configure CORS for WebSocket connections:

```toml
# Add CORS headers in your worker code
headers = [
  { key = "Access-Control-Allow-Origin", value = "*" },
  { key = "Access-Control-Allow-Methods", value = "GET, POST, OPTIONS" },
  { key = "Access-Control-Allow-Headers", value = "Content-Type" }
]
```

### Rate Limiting

Consider implementing rate limiting in your application logic:

- Connection rate limiting
- Message rate limiting
- Concurrent connection limits

## Monitoring and Logging

### Log Configuration

Enable logging for debugging:

```toml
[env.production]
logpush = true
tail_consumers = [
  { service = "log-aggregator" }
]
```

### Performance Monitoring

Monitor WebSocket connection performance:

- Connection establishment time
- Message latency
- Memory usage patterns
- Error rates

## Migration and Updates

### Configuration Migration

When updating configurations:

1. Test in development environment first
2. Use version control for configuration files
3. Plan downtime for breaking changes
4. Monitor after deployment

### Compatibility Updates

Regularly update compatibility dates:

```toml
compatibility_date = "latest-date-available"
```

## Troubleshooting Configuration Issues

### Common Configuration Problems

1. **Account ID Missing**: Ensure account_id is set for production
2. **Route Conflicts**: Verify route patterns don't conflict
3. **Environment Variables**: Check secret variables are properly set
4. **Domain Verification**: Confirm domain ownership for custom routes

### Debugging Commands

```bash
# Validate configuration
wrangler validate

# Check current configuration
wrangler whoami

# Preview deployment
wrangler deploy --dry-run
```

## Best Practices

### Configuration Management

- Use version control for all configuration files
- Separate secrets from configuration
- Use environment-specific configurations
- Regular backup of configuration files

### Security Best Practices

- Never commit secrets to version control
- Use wrangler secret for sensitive data
- Regular rotation of API keys
- Minimal required permissions
