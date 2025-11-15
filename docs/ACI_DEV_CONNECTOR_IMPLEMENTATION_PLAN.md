# ACI.dev Connector Implementation Plan

**Total Target: 600+ Integrations**  
**Approach: Build our own connectors (no ACI.dev dependency)**

---

## Implementation Strategy

### Phase 1: Tier 1 - High Priority (100 connectors)
**Timeline: 4-6 weeks**  
**Focus: Most commonly used services across all categories**

### Phase 2: Tier 2 - Medium Priority (200 connectors)
**Timeline: 8-10 weeks**  
**Focus: Popular services with good API support**

### Phase 3: Tier 3 - Lower Priority (300+ connectors)
**Timeline: 12-16 weeks**  
**Focus: Niche services and less common tools**

---

## Implementation Process

For each connector, we need to:

1. **Register Manifest** in `backend/src/services/connectors/registry.ts`
2. **Create Executor** in `backend/src/services/nodeExecutors/connectors/{connectorId}.ts`
3. **Add Routing** in `backend/src/services/nodeExecutors/connector.ts`
4. **Test** the connector with real API calls
5. **Document** the connector usage

---

## Tier 1: High Priority Connectors (100)

### Communication (25 connectors)

#### Email Services (8)
- [ ] **Gmail** - OAuth2, send/receive emails
- [ ] **Outlook/Microsoft 365 Mail** - OAuth2, send/receive emails
- [ ] **SendGrid** - API Key, transactional emails
- [ ] **Mailgun** - API Key, transactional emails
- [ ] **Postmark** - API Key, transactional emails
- [ ] **Amazon SES** - AWS credentials, transactional emails
- [ ] **Resend** - API Key, transactional emails
- [ ] **Mailchimp Transactional** - API Key, transactional emails

#### Messaging & Chat (8)
- [ ] **Slack** ✅ (Already implemented)
- [ ] **Microsoft Teams** ✅ (Manifest exists, needs executor)
- [ ] **Discord** ✅ (Manifest exists, needs executor)
- [ ] **Telegram** - Bot API, send messages
- [ ] **WhatsApp Business API** - Twilio/WhatsApp API
- [ ] **Twilio SMS/Voice** ✅ (Manifest exists, needs executor)
- [ ] **Vonage** - SMS/Voice API
- [ ] **Intercom** - OAuth2, customer messaging

#### Customer Support (5)
- [ ] **Zendesk** - OAuth2, ticket management
- [ ] **Freshdesk** - API Key, ticket management
- [ ] **Help Scout** - OAuth2, ticket management
- [ ] **Crisp** - API Key, live chat
- [ ] **Drift** - OAuth2, live chat

#### Video Conferencing (4)
- [ ] **Zoom** - OAuth2, create meetings
- [ ] **Google Meet** - OAuth2, create meetings
- [ ] **Calendly** - OAuth2, scheduling
- [ ] **Cal.com** - API Key, scheduling

---

### CRM & Sales (20 connectors)

#### Major CRMs (8)
- [ ] **Salesforce** ✅ (Manifest exists, needs executor)
- [ ] **HubSpot** ✅ (Manifest exists, needs executor)
- [ ] **Pipedrive** ✅ (Manifest exists, needs executor)
- [ ] **Zoho CRM** ✅ (Manifest exists, needs executor)
- [ ] **Microsoft Dynamics 365** - OAuth2
- [ ] **SugarCRM** - OAuth2
- [ ] **Close** - API Key
- [ ] **Streak** - OAuth2

#### Email Marketing (6)
- [ ] **Mailchimp** - OAuth2, marketing campaigns
- [ ] **Constant Contact** - OAuth2
- [ ] **Campaign Monitor** - API Key
- [ ] **ConvertKit** - API Key
- [ ] **ActiveCampaign** - API Key
- [ ] **Klaviyo** - API Key

#### Sales Tools (6)
- [ ] **Outreach** - OAuth2
- [ ] **SalesLoft** - OAuth2
- [ ] **Gong** - OAuth2
- [ ] **Clearbit** - API Key
- [ ] **ZoomInfo** - API Key
- [ ] **Apollo.io** - API Key

---

### Productivity & Project Management (20 connectors)

#### Project Management (10)
- [ ] **Asana** ✅ (Manifest exists, needs executor)
- [ ] **Trello** ✅ (Manifest exists, needs executor)
- [ ] **Monday.com** ✅ (Manifest exists, needs executor)
- [ ] **Jira** ✅ (Manifest exists, needs executor)
- [ ] **ClickUp** - OAuth2
- [ ] **Notion** - OAuth2
- [ ] **Airtable** ✅ (Already implemented)
- [ ] **Basecamp** - OAuth2
- [ ] **Wrike** - OAuth2
- [ ] **Linear** - API Key

#### Calendar & Scheduling (5)
- [ ] **Google Calendar** - OAuth2
- [ ] **Outlook Calendar** - OAuth2
- [ ] **Calendly** - OAuth2 (duplicate from Communication)
- [ ] **Cal.com** - API Key (duplicate from Communication)
- [ ] **Acuity Scheduling** - OAuth2

#### File Storage & Sharing (5)
- [ ] **Google Drive** - OAuth2
- [ ] **Dropbox** - OAuth2
- [ ] **OneDrive** - OAuth2
- [ ] **Box** - OAuth2
- [ ] **Amazon S3** - AWS credentials

---

### E-commerce & Payments (15 connectors)

#### E-commerce Platforms (6)
- [ ] **Shopify** ✅ (Manifest exists, needs executor)
- [ ] **WooCommerce** ✅ (Manifest exists, needs executor)
- [ ] **BigCommerce** - OAuth2
- [ ] **Magento** - OAuth2
- [ ] **Squarespace Commerce** - OAuth2
- [ ] **Etsy** - OAuth2

#### Payment Gateways (6)
- [ ] **Stripe** ✅ (Manifest exists, needs executor)
- [ ] **PayPal** ✅ (Manifest exists, needs executor)
- [ ] **Square** - OAuth2
- [ ] **Braintree** - OAuth2
- [ ] **Razorpay** - API Key
- [ ] **Adyen** - API Key

#### Order Management (3)
- [ ] **ShipStation** - API Key
- [ ] **Shippo** - API Key
- [ ] **EasyPost** - API Key

---

### Databases & Data (10 connectors)

#### SQL Databases (4)
- [ ] **PostgreSQL** ✅ (Manifest exists, needs executor)
- [ ] **MySQL** ✅ (Manifest exists, needs executor)
- [ ] **Microsoft SQL Server** - Connection string
- [ ] **Amazon RDS** - AWS credentials

#### NoSQL Databases (3)
- [ ] **MongoDB** ✅ (Manifest exists, needs executor)
- [ ] **Redis** ✅ (Manifest exists, needs executor)
- [ ] **DynamoDB** - AWS credentials

#### Data Warehouses (2)
- [ ] **Snowflake** - OAuth2
- [ ] **BigQuery** - OAuth2

#### Spreadsheets (1)
- [ ] **Google Sheets** ✅ (Already implemented)

---

### Developer Tools & APIs (10 connectors)

#### Version Control (3)
- [ ] **GitHub** - OAuth2
- [ ] **GitLab** - OAuth2
- [ ] **Bitbucket** - OAuth2

#### CI/CD (2)
- [ ] **GitHub Actions** - OAuth2 (via GitHub)
- [ ] **CircleCI** - API Key

#### Cloud Platforms (2)
- [ ] **AWS** - AWS credentials
- [ ] **Google Cloud Platform** - OAuth2

#### Hosting & Deployment (3)
- [ ] **Vercel** - OAuth2
- [ ] **Netlify** - OAuth2
- [ ] **Heroku** - OAuth2

---

## Tier 2: Medium Priority Connectors (200)

### Communication (30 connectors)
- Additional email services, messaging platforms, video conferencing tools

### CRM & Sales (40 connectors)
- Additional CRMs, email marketing tools, sales automation platforms

### Productivity (50 connectors)
- Additional project management tools, note-taking apps, file storage services

### E-commerce (30 connectors)
- Additional e-commerce platforms, payment gateways, shipping services

### Databases & Data (20 connectors)
- Additional databases, data warehouses, analytics platforms

### Developer Tools (30 connectors)
- Additional version control, CI/CD, cloud platforms, monitoring tools

---

## Tier 3: Lower Priority Connectors (300+)

### All Remaining Categories
- Social Media (40+)
- Marketing & Analytics (60+)
- Finance & Accounting (30+)
- HR & People Management (30+)
- AI & Machine Learning (40+)
- Search & Research (20+)
- Forms & Surveys (20+)
- Webhooks & APIs (30+)
- Security & Authentication (20+)
- Other Services (50+)

---

## Implementation Checklist Template

For each connector:

- [ ] **1. Research API Documentation**
  - [ ] Authentication method (OAuth2, API Key, etc.)
  - [ ] Available endpoints
  - [ ] Rate limits
  - [ ] Error handling

- [ ] **2. Register Manifest**
  - [ ] Add to `registry.ts` `registerBuiltInConnectors()` or `registerNangoConnectors()`
  - [ ] Define actions with input/output schemas
  - [ ] Set OAuth provider (if applicable)

- [ ] **3. Create Executor**
  - [ ] Create `backend/src/services/nodeExecutors/connectors/{connectorId}.ts`
  - [ ] Implement action handlers
  - [ ] Add error handling
  - [ ] Add input validation

- [ ] **4. Add Routing**
  - [ ] Add case in `connector.ts` `executeConnectorAction()`
  - [ ] Import executor function

- [ ] **5. Test**
  - [ ] Test with real API credentials
  - [ ] Test error cases
  - [ ] Test rate limiting

- [ ] **6. Document**
  - [ ] Add usage examples
  - [ ] Document authentication setup
  - [ ] Document available actions

---

## Priority Order for Tier 1

**Week 1-2: Communication (25 connectors)**
1. Gmail
2. Outlook
3. SendGrid
4. Mailgun
5. Telegram
6. WhatsApp Business API
7. Zendesk
8. Zoom

**Week 3-4: CRM & Sales (20 connectors)**
1. Salesforce (executor)
2. HubSpot (executor)
3. Pipedrive (executor)
4. Mailchimp
5. ActiveCampaign
6. Stripe (executor)
7. PayPal (executor)

**Week 5-6: Productivity & E-commerce (35 connectors)**
1. Asana (executor)
2. Trello (executor)
3. Monday.com (executor)
4. Jira (executor)
5. Google Calendar
6. Google Drive
7. Dropbox
8. Shopify (executor)
9. WooCommerce (executor)

**Week 7-8: Databases & Developer Tools (20 connectors)**
1. PostgreSQL (executor)
2. MySQL (executor)
3. MongoDB (executor)
4. Redis (executor)
5. GitHub
6. GitLab
7. Vercel
8. Netlify

---

## Notes

- Connectors marked with ✅ have manifests but may need executors
- OAuth2 connectors will use Nango for authentication
- API Key connectors will store credentials in database
- All connectors will be available as `integration.{connectorId}` nodes
- Each connector will support multiple actions
- Error handling and retry logic will be standardized

---

**Last Updated:** 2025-01-XX  
**Status:** Planning Phase → Implementation Phase

