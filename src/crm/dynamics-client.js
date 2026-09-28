class DynamicsClient {
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.tenantId = options.tenantId;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.tokenCache = { accessToken: null, expiresAt: 0 };
  }

  validateConfiguration() {
    if (!this.baseUrl || !this.tenantId || !this.clientId || !this.clientSecret) {
      throw new Error("Dynamics mode requires DYNAMICS_BASE_URL, DYNAMICS_TENANT_ID, DYNAMICS_CLIENT_ID and DYNAMICS_CLIENT_SECRET.");
    }
  }

  async getAccessToken() {
    this.validateConfiguration();
    const now = Math.floor(Date.now() / 1000);
    if (this.tokenCache.accessToken && this.tokenCache.expiresAt > now + 60) {
      return this.tokenCache.accessToken;
    }

    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials",
      scope: `${this.baseUrl}/.default`
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });

    if (!response.ok) {
      throw new Error(`Dynamics OAuth token request failed with HTTP ${response.status}.`);
    }

    const data = await response.json();
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: now + Number(data.expires_in || 3600)
    };
    return data.access_token;
  }

  async patchRecord(entitySetName, id, patch) {
    if (!Object.keys(patch).length) {
      return { skipped: true, reason: "empty patch", mode: "dynamics" };
    }

    const token = await this.getAccessToken();
    const safeId = String(id).replace(/[{}]/g, "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeId)) {
      throw new Error("Dynamics record ID must be a valid GUID.");
    }
    const url = `${this.baseUrl}/api/data/v9.2/${entitySetName}(${safeId})`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      },
      body: JSON.stringify(patch)
    });

    if (!response.ok) {
      throw new Error(`Dynamics PATCH failed for ${entitySetName} with HTTP ${response.status}.`);
    }

    return {
      success: true,
      mode: "dynamics",
      entitySetName,
      id: safeId,
      updatedFields: Object.keys(patch)
    };
  }
}

module.exports = { DynamicsClient };
