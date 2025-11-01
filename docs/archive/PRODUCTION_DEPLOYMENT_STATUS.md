# Production Deployment Status

**Last Updated**: 2025-10-28 (After server restart)
**Server**: 223.130.150.133
**Domain**: [https://aed.pics](https://aed.pics) | [https://www.aed.pics](https://www.aed.pics)

## Current Status

### Infrastructure (Completed)

#### Server Configuration
- NCP Server: 223.130.150.133
- Operating System: Ubuntu 22.04 LTS
- Node.js: v20.18.1
- PM2: 5.4.2
- Nginx: 1.24.0
- PostgreSQL Client: Installed

#### DNS Configuration
- Domain: aed.pics
- Nameservers: Cloudflare (jasmine.ns.cloudflare.com, sergi.ns.cloudflare.com)
- DNS Propagation: Complete
- A Records: aed.pics → 223.130.150.133
- CNAME: www.aed.pics → aed.pics

#### SSL Certificate
- Provider: Let's Encrypt
- Domains: aed.pics, www.aed.pics
- Status: Active
- Expiration: 2026-01-25
- Auto-renewal: Configured via certbot

#### Security
- fail2ban: v1.0.2 (Active)
- SSH Protection: 5 failed attempts within 10 minutes = 1 hour ban
- HTTPS: Forced redirect from HTTP
- Firewall: NCP ACG configured (ports 22, 80, 443)

### Application Status

#### Deployment
- Repository: Cloned to /var/www/aedpics
- Dependencies: npm ci completed
- Prisma: Client generated
- Build: Next.js production build completed
- PM2: aedpics app running on port 3000
- Nginx: Reverse proxy configured for ports 80/443 → 3000

#### Web Accessibility Test (2025-10-28 23:48 UTC)
```
$ curl -I https://aed.pics
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Content-Type: text/html; charset=utf-8
Content-Length: 52833
X-Powered-By: Next.js
```

Status: **Website is live and accessible**

### Environment Variables

#### Upload Status
File: `/var/www/aedpics/.env`
Upload Date: 2025-10-28
Method: SCP from local /tmp/production.env

#### Configuration (13 Variables)
- Database Connection (NCP PostgreSQL)
  - DATABASE_URL
- NextAuth.js Authentication
  - NEXTAUTH_URL: http://223.130.150.133
  - NEXTAUTH_SECRET
  - JWT_SECRET
- Master Account
  - MASTER_EMAIL: admin@nmc.or.kr
- Kakao Maps API
  - NEXT_PUBLIC_KAKAO_MAP_APP_KEY
- NCP Cloud Outbound Mailer
  - NCP_ACCESS_KEY: [REDACTED - See server .env file]
  - NCP_ACCESS_SECRET: [REDACTED - See server .env file]
  - NCP_SENDER_EMAIL: noreply@aed.pics
- Application URLs
  - NEXT_PUBLIC_SITE_URL: http://223.130.150.133
- Security
  - ENCRYPTION_KEY
- Production Settings
  - NODE_ENV: production
  - PORT: 3000

### Database

#### NCP PostgreSQL
- Host: pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com
- Port: 5432
- Database: aedpics_production
- Schema: aedpics
- User: aedpics_admin
- Status: Connected

#### Data Migration
- Organizations: 291 records
- User Profiles: 24 records
- AED Data: 81,464 records
- Prisma Models: 23 models
- Enums: 25 enums

## Pending Tasks

### Critical (Required for Full Production)

#### 1. PM2 Restart to Load Environment Variables
**Status**: Pending - SSH access currently blocked
**Priority**: High
**Reason**: Environment variables uploaded but PM2 needs restart to load them

**Manual Steps Required**:
```bash
# Access server via SSH
ssh root@223.130.150.133

# Navigate to application directory
cd /var/www/aedpics

# Verify .env file exists
ls -la .env
cat .env | head -20

# Restart PM2 to load new environment variables
pm2 restart aedpics

# Check PM2 status and logs
pm2 status
pm2 logs aedpics --lines 50

# Verify environment variables loaded
pm2 env 0

# Save PM2 configuration
pm2 save
```

**Expected Result**: PM2 reloads with new environment variables, enabling:
- NCP email service (OTP, password reset, notifications)
- Kakao Maps with correct API key
- Proper authentication with NCP-specific secrets

#### 2. Functional Testing
**Status**: Pending - Requires PM2 restart first
**Priority**: High

**Test Cases**:
- [ ] User registration with email OTP
- [ ] Login/Logout flow
- [ ] Password reset via NCP email
- [ ] Kakao Maps display on AED data page
- [ ] Database queries (AED data retrieval)
- [ ] Admin approval workflow
- [ ] Organization management
- [ ] User profile updates

#### 3. Update Application URLs
**Status**: Pending
**Priority**: Medium

**Changes Needed**:
```bash
# Update .env on server
NEXTAUTH_URL="https://aed.pics"
NEXT_PUBLIC_SITE_URL="https://aed.pics"
```

**Reason**: Currently using HTTP URLs, should use HTTPS after SSL configured

### Optional (Production Enhancements)

#### 4. Monitoring Setup
- [ ] PM2 monitoring dashboard
- [ ] Application error logging
- [ ] Database performance monitoring
- [ ] SSL certificate renewal alerts
- [ ] Disk space monitoring

#### 5. Backup System
- [ ] Automated daily database backups
- [ ] Backup to NCP Object Storage
- [ ] Application code backups
- [ ] Environment variable backups (encrypted)

#### 6. Performance Optimization
- [ ] Next.js caching configuration
- [ ] Database query optimization
- [ ] CDN setup for static assets
- [ ] Image optimization

#### 7. Documentation
- [ ] User manual
- [ ] Admin manual
- [ ] API documentation
- [ ] Deployment runbook

## Migration Phases Completed

- [x] Phase 1: Infrastructure Setup
  - [x] Server provisioning
  - [x] Node.js, PM2, Nginx installation
  - [x] PostgreSQL connection
- [x] Phase 2: Data Migration
  - [x] Prisma schema creation (979 lines, 23 models)
  - [x] Organizations migration (291 records)
  - [x] User profiles migration (24 records)
  - [x] AED data migration (81,464 records)
- [x] Phase 3: Application Deployment
  - [x] Repository cloning
  - [x] Dependencies installation
  - [x] Production build
  - [x] PM2 process manager setup
- [x] Phase 4: Nginx Reverse Proxy
  - [x] Nginx installation and configuration
  - [x] Port 80 HTTP setup
  - [x] Port 443 HTTPS setup
- [x] Phase 5: DNS and SSL
  - [x] Domain registration (aed.pics)
  - [x] Cloudflare DNS configuration
  - [x] Let's Encrypt SSL certificate
  - [x] HTTP to HTTPS redirect
- [x] Phase 6: NCP Email Migration
  - [x] NCP Cloud Outbound Mailer integration
  - [x] Email service code implementation
  - [x] Password reset functionality
  - [x] OTP delivery system
- [x] Phase 7: Environment Variables Configuration
  - [x] Production .env file creation
  - [x] NCP API keys acquisition
  - [x] Kakao Maps API key configuration
  - [x] File upload to server
- [x] Phase 8: GitHub Secrets Configuration
  - [x] Deployment Secrets (14 Secrets)
  - [x] Database Backup Secrets (5 Secrets)
  - [x] GitHub Actions workflows configured
  - [x] Automated testing ready

## Known Issues

### SSH Access Blocked
**Issue**: SSH connection timeout when attempting to access server
**Possible Causes**:
1. fail2ban blocked IP after multiple connection attempts
2. NCP ACG firewall SSH restrictions
3. SSH service temporarily unavailable

**Impact**: Cannot execute PM2 restart command remotely

**Workaround**:
- Access server via NCP Console (Serial Console)
- Or wait for fail2ban ban to expire (1 hour)
- Or whitelist IP in fail2ban configuration

**Resolution Required**: Yes - SSH access needed for PM2 restart

### ICMP Blocked
**Issue**: Ping requests timeout (100% packet loss)
**Cause**: NCP firewall blocks ICMP by default
**Impact**: None - Normal security configuration
**Resolution**: Not required - HTTPS accessibility confirmed

## Next Session Tasks

1. **Restore SSH Access**
   - Check fail2ban status
   - Verify NCP ACG SSH rules
   - Access via NCP Console if needed

2. **Complete PM2 Restart**
   - Load new environment variables
   - Verify application startup
   - Check logs for errors

3. **Update Application URLs to HTTPS**
   - Edit .env file
   - Restart PM2
   - Test NextAuth redirect flow

4. **Functional Testing**
   - Test all authentication flows
   - Verify email sending via NCP
   - Test Kakao Maps integration
   - Validate database operations

5. **Production Monitoring Setup**
   - Configure PM2 monitoring
   - Set up log aggregation
   - Configure alerting

## References

- [NCP Production Setup Guide](./NCP_PRODUCTION_SETUP.md)
- [Migration Complete Guide](../migration/NCP_마이그레이션_완전가이드.md)
- [Migration Status](../migration/MIGRATION_STATUS.md)
- [Backup Guide](./BACKUP_GUIDE.md)
- [CI/CD Setup](./CICD_SETUP.md)

## Support Contacts

- System Administrator: truth0530@nmc.or.kr
- Technical Support: inhak@nmc.or.kr
- Project Manager: woo@nmc.or.kr

---

**Production URL**: https://aed.pics
**Server IP**: 223.130.150.133
**Database**: aedpics_production@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com
**Application**: Next.js 14 on Node.js 20.18.1
**Process Manager**: PM2 5.4.2
**Web Server**: Nginx 1.24.0
**SSL**: Let's Encrypt (Valid until 2026-01-25)
