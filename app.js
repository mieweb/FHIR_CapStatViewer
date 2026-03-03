// FHIR CapabilityStatement Viewer Application
class FHIRCapabilityViewer {
    constructor() {
        this.capabilityData = null;
        this.initializeEventListeners();
        this.checkUrlParameters();
    }

    initializeEventListeners() {
        // Load button click handler
        document.getElementById('load-button').addEventListener('click', () => {
            this.loadCapabilityStatement();
        });

        // Enter key handler for URL input
        document.getElementById('fhir-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadCapabilityStatement();
            }
        });

        // Demo button click handler
        document.getElementById('demo-button').addEventListener('click', () => {
            this.loadDemoData();
        });

        // Tab switching handlers
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Permalink button handler
        document.getElementById('permalink-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.generatePermalink();
        });
    }

    async loadCapabilityStatement() {
        const urlInput = document.getElementById('fhir-url');
        const url = urlInput.value.trim();

        if (!url) {
            this.showError('Please enter a valid FHIR CapabilityStatement URL');
            return;
        }

        if (!this.isValidUrl(url)) {
            this.showError('Please enter a valid URL format');
            return;
        }

        this.showLoading();
        this.hideError();
        this.hideResults();

        try {
            // Try multiple approaches to handle CORS
            let response;
            let data;
            let usedProxy = false;
            
            // First, try direct fetch
            try {
                console.log('Attempting direct fetch to:', url);
                response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_format=json`, {
                    method: 'GET',
                    mode: 'cors',
                    headers: {
                        'Accept': 'application/fhir+json, application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                console.log('Direct fetch successful, parsing JSON...');
                data = await response.json();
                console.log('Direct fetch complete, data:', data.resourceType);
            } catch (corsError) {
                console.log('Direct fetch failed, trying CORS proxy...', corsError);
                usedProxy = true;
                
                try {
                    // Try local proxy first (if available)
                    // This works with both proxy.php and proxy-server.py
                    let localProxyUrl = window.location.origin + '/proxy?url=';
                    let proxiedUrl = localProxyUrl + encodeURIComponent(`${url}${url.includes('?') ? '&' : '?'}_format=json`);
                    
                    console.log('Attempting local proxy fetch to:', proxiedUrl);
                    
                    try {
                        response = await fetch(proxiedUrl, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            }
                        });

                        if (response.ok) {
                            console.log('Local proxy fetch successful, parsing JSON...');
                            data = await response.json();
                            console.log('Local proxy complete, data:', data.resourceType);
                        } else {
                            throw new Error(`Local proxy returned HTTP ${response.status}`);
                        }
                    } catch (localProxyError) {
                        console.log('Local proxy failed, trying third-party proxy...', localProxyError);
                        
                        // If local proxy fails, try using third-party CORS proxy
                        const thirdPartyProxyUrl = 'https://api.allorigins.win/get?url=';
                        proxiedUrl = thirdPartyProxyUrl + encodeURIComponent(`${url}${url.includes('?') ? '&' : '?'}_format=json`);
                        
                        console.log('Attempting third-party proxy fetch to:', proxiedUrl);
                        response = await fetch(proxiedUrl, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            }
                        });

                        if (!response.ok) {
                            // If allorigins fails, try corsproxy.io as backup
                            if (response.status === 408 || response.status >= 400) {
                                console.log('Third-party proxy failed, trying alternative proxy...');
                                const altProxyUrl = 'https://corsproxy.io/?';
                                const altProxiedUrl = altProxyUrl + encodeURIComponent(`${url}${url.includes('?') ? '&' : '?'}_format=json`);
                            
                                console.log('Attempting alternative proxy fetch to:', altProxiedUrl);
                                response = await fetch(altProxiedUrl, {
                                    method: 'GET',
                                    headers: {
                                        'Accept': 'application/fhir+json, application/json'
                                    }
                                });
                                
                                if (!response.ok) {
                                    throw new Error(`Alternative proxy request failed: HTTP ${response.status}: ${response.statusText}`);
                                }
                                
                                console.log('Alternative proxy fetch successful, parsing JSON...');
                                // The alternative proxy returns the JSON directly (not wrapped)
                                let responseText = await response.text();
                                console.log('Alternative proxy response length:', responseText.length);
                                
                                // Clean the response more thoroughly
                                responseText = responseText
                                    // Remove null bytes and control characters
                                    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
                                    // Normalize line endings
                                    .replace(/\r\n/g, '\n')
                                    .replace(/\r/g, '\n');
                                
                                try {
                                    data = JSON.parse(responseText);
                                    console.log('Alternative proxy parsing complete, data:', data.resourceType);
                                } catch (parseError) {
                                    console.error('Alternative proxy JSON parsing failed:', parseError);
                                    
                                    // Show the problematic area if we can find it
                                    const errorPos = parseError.message.match(/position (\d+)/);
                                    if (errorPos) {
                                        const pos = parseInt(errorPos[1]);
                                        const problemArea = responseText.substring(Math.max(0, pos - 100), pos + 100);
                                        console.log('Alternative proxy problem area:', problemArea);
                                    }
                                    
                                    // Extract line/column info for better error reporting
                                    let errorDetails = parseError.message;
                                    const lineMatch = parseError.message.match(/line (\d+)/);
                                    const posMatch = parseError.message.match(/position (\d+)/);
                                    
                                    if (lineMatch && posMatch) {
                                        errorDetails = `JSON Parse Error at line ${lineMatch[1]}, position ${posMatch[1]}: ${parseError.message}`;
                                    }
                                    
                                    throw new Error(`FHIR Server JSON Malformed: ${errorDetails}`);
                                }
                            } else {
                                throw new Error(`Proxy request failed: HTTP ${response.status}: ${response.statusText}`);
                            }
                        } else {
                            // Third-party proxy (allorigins) was successful
                            console.log('Third-party proxy fetch successful, parsing response...');
                            const proxyResponse = await response.json();
                            console.log('Third-party proxy response status:', proxyResponse.status);
                        
                        if (proxyResponse.status && proxyResponse.status.http_code !== 200) {
                            throw new Error(`FHIR server returned HTTP ${proxyResponse.status.http_code}`);
                        }
                        
                        try {
                            console.log('Parsing FHIR JSON from proxy...');
                            
                            // More robust cleaning of the contents
                            let cleanContents = proxyResponse.contents;
                            
                            // Remove or replace problematic control characters
                            cleanContents = cleanContents
                                // Remove null bytes and other problematic characters
                                .replace(/\x00/g, '')
                                .replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ' ')
                                // Fix common JSON issues
                                .replace(/\r\n/g, '\n')
                                .replace(/\r/g, '\n')
                                // Remove any remaining control characters that might cause issues
                                .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
                            
                            console.log('Cleaned content length:', cleanContents.length);
                            data = JSON.parse(cleanContents);
                            console.log('Proxy parsing complete, data:', data.resourceType);
                        } catch (parseError) {
                            console.error('JSON parsing failed:', parseError);
                            console.log('Attempting to identify problematic character...');
                            
                            // Try to find the exact problematic character
                            try {
                                const errorPos = parseError.message.match(/position (\d+)/);
                                if (errorPos) {
                                    const pos = parseInt(errorPos[1]);
                                    const problemArea = proxyResponse.contents.substring(Math.max(0, pos - 50), pos + 50);
                                    console.log('Problem area around position', pos, ':', problemArea);
                                    
                                    // Try targeted JSON fixing
                                    let fixedContent = proxyResponse.contents;
                                    
                                    // Fix common JSON malformation issues
                                    fixedContent = fixedContent
                                        // Remove control characters
                                        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                                        // Fix unescaped quotes in strings
                                        .replace(/": "([^"]*),\s*"([^"]*)" :/g, '": "$1,$2" :')
                                        // Fix missing quotes before commas in property values
                                        .replace(/: "([^"]*),$/gm, ': "$1",')
                                        .replace(/: "([^"]*),\s*$/gm, ': "$1",')
                                        // Fix the specific pattern we saw
                                        .replace(/: "([^"]*),\s*"([^"]*)" :/g, ': "$1", "$2" :')
                                        // Fix trailing commas in objects
                                        .replace(/,(\s*[}\]])/g, '$1')
                                        // Normalize whitespace
                                        .replace(/\s+/g, ' ');
                                    
                                    console.log('Attempting targeted JSON repair...');
                                    data = JSON.parse(fixedContent);
                                    console.log('Targeted JSON repair succeeded!');
                                } else {
                                    throw parseError;
                                }
                            } catch (secondError) {
                                console.error('All JSON repair attempts failed:', secondError);
                                
                                // If JSON parsing fails, the response might be HTML error page
                                if (proxyResponse.contents && proxyResponse.contents.includes('<html>')) {
                                    throw new Error('The server returned an HTML page instead of JSON. This might indicate the URL is incorrect or the server is not responding properly.');
                                }
                                
                                // Extract line/column info for better error reporting
                                let errorDetails = parseError.message;
                                const lineMatch = parseError.message.match(/line (\d+)/);
                                const posMatch = parseError.message.match(/position (\d+)/);
                                
                                if (lineMatch && posMatch) {
                                    errorDetails = `JSON Parse Error at line ${lineMatch[1]}, position ${posMatch[1]}: ${parseError.message}`;
                                }
                                
                                throw new Error(`FHIR Server JSON Malformed: ${errorDetails}`);
                            }
                        }
                    }
                    } // End of local proxy try-catch
                } catch (proxyError) {
                    console.error('Proxy fetch also failed:', proxyError);
                    throw new Error(`Both direct connection and proxy failed. Direct error: ${corsError.message}. Proxy error: ${proxyError.message}`);
                }
            }
            
            console.log('Validating CapabilityStatement...');
            if (!this.isValidCapabilityStatement(data)) {
                console.error('Validation failed for data:', data);
                throw new Error('The response does not appear to be a valid FHIR CapabilityStatement');
            }

            console.log('CapabilityStatement validated, storing and displaying...');
            this.capabilityData = data;
            this.displayCapabilityStatement();
            
        } catch (error) {
            console.error('Error loading CapabilityStatement:', error);
            
            let errorMessage = error.message;
            
            // Provide more helpful error messages for common issues
            // Check most specific errors first
            if (error.message.includes('FHIR Server JSON Malformed') || error.message.includes('JSON Parse Error')) {
                errorMessage = `⚠️ MALFORMED JSON DETECTED: The FHIR server returned invalid JSON data.

📍 ISSUE: ${error.message}

🔧 REQUIRED FIX: The FHIR server administrator needs to fix the JSON output.

Common causes:
• Missing quotes around property values
• Unescaped characters in JSON strings
• Trailing commas or malformed syntax
• Character encoding issues in the server response

📋 ACTION REQUIRED:
• Contact your FHIR server administrator
• Share this error message with them
• Ask them to validate the CapabilityStatement JSON output
• Server should return valid JSON that passes JSON.parse()

🧪 TEST: Try validating the raw JSON at https://jsonlint.com/
URL: ${url}`;
            } else if (error.message.includes('Both direct connection and proxy failed')) {
                errorMessage = `⚠️ CONNECTION FAILED: Unable to retrieve FHIR data through any method.

Error Details: ${error.message}

This might be due to:
• FHIR server is temporarily unavailable
• Network connectivity issues
• Firewall or security restrictions
• Both CORS proxies are down or blocked

Try:
• Verify the URL works in a browser: ${url}
• Wait a moment and try again
• Check your internet connection
• Contact server administrator if issue persists`;
            } else if (error.message.includes('408') || error.message.includes('timeout')) {
                errorMessage = `Request timeout: The FHIR server is taking too long to respond. This might be due to:
                • Server performance issues or high load
                • Network latency or slow connection
                • Server-side processing delays
                
                Try:
                • Waiting a moment and trying again
                • Checking if the server is responding normally in a browser
                • Contacting the server administrator if the issue persists`;
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = `Network error: Unable to fetch data from the FHIR server. This might be due to:
                • CORS (Cross-Origin Resource Sharing) restrictions
                • Network connectivity issues
                • Invalid URL or server not responding
                
                Try:
                • Checking if the URL is correct and accessible in a browser
                • Using a different FHIR server that allows CORS
                • Running this application from an HTTPS server instead of file://`;
            }
            
            this.showError(errorMessage);
        } finally {
            this.hideLoading();
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    isValidCapabilityStatement(data) {
        return data && 
               data.resourceType === 'CapabilityStatement' &&
               data.fhirVersion;
    }

    showLoading() {
        document.getElementById('loading-section').style.display = 'block';
        document.getElementById('load-button').disabled = true;
    }

    hideLoading() {
        document.getElementById('loading-section').style.display = 'none';
        document.getElementById('load-button').disabled = false;
    }

    showError(message) {
        document.getElementById('error-text').textContent = message;
        document.getElementById('error-section').style.display = 'block';
    }

    hideError() {
        document.getElementById('error-section').style.display = 'none';
    }

    hideResults() {
        document.getElementById('results-section').style.display = 'none';
    }

    showResults() {
        document.getElementById('results-section').style.display = 'block';
    }

    displayCapabilityStatement() {
        this.renderOverview();
        this.renderResources();
        this.renderInteractions();
        this.renderOperations();
        this.renderSearchParameters();
        this.renderSecurity();
        this.renderTesting();
        this.renderRawData();
        this.showResults();
    }

    renderOverview() {
        const data = this.capabilityData;
        const overviewContent = document.getElementById('overview-content');
        
        const overviewHtml = `
            <div class="overview-list">
                ${data.title ? `
                <div class="overview-row">
                    <div class="overview-label">Title</div>
                    <div class="overview-value">${data.title}</div>
                </div>
                ` : ''}
                <div class="overview-row">
                    <div class="overview-label">Server Name</div>
                    <div class="overview-value">${data.name || 'Not specified'}</div>
                </div>
                <div class="overview-row">
                    <div class="overview-label">FHIR Version</div>
                    <div class="overview-value">${data.fhirVersion}</div>
                </div>
                <div class="overview-row">
                    <div class="overview-label">Status</div>
                    <div class="overview-value">${data.status || 'Unknown'}</div>
                </div>
                <div class="overview-row">
                    <div class="overview-label">Date</div>
                    <div class="overview-value">${data.date ? new Date(data.date).toLocaleDateString() : 'Not specified'}</div>
                </div>
                <div class="overview-row">
                    <div class="overview-label">Publisher</div>
                    <div class="overview-value">${data.publisher || 'Not specified'}</div>
                </div>
                <div class="overview-row">
                    <div class="overview-label">Software/Name</div>
                    <div class="overview-value">${data.software?.name || 'Not specified'}</div>
                </div>
                <div class="overview-row">
                    <div class="overview-label">Kind</div>
                    <div class="overview-value">${data.kind || 'Not specified'}</div>
                </div>
            </div>
            ${data.description ? `<div style="margin-top: 1.5rem;"><h3>Description</h3><p>${data.description}</p></div>` : ''}
            ${this.renderContactInfo(data.contact)}
        `;
        
        overviewContent.innerHTML = overviewHtml;
    }

    renderContactInfo(contacts) {
        if (!contacts || contacts.length === 0) {
            return '';
        }

        let contactHtml = '<div style="margin-top: 1.5rem;"><h3>Contact Information</h3>';
        
        contacts.forEach((contact, index) => {
            contactHtml += '<div class="contact-card">';
            
            // Contact name
            if (contact.name) {
                contactHtml += `<div class="contact-field"><strong>Name:</strong> ${contact.name}</div>`;
            }
            
            // Telecom information (phone, email, url, etc.)
            if (contact.telecom && contact.telecom.length > 0) {
                contact.telecom.forEach(telecom => {
                    const system = telecom.system || 'contact';
                    const value = telecom.value || '';
                    const use = telecom.use ? ` (${telecom.use})` : '';
                    
                    if (value) {
                        let displayValue = value;
                        
                        // Make URLs clickable
                        if (system === 'url' || value.startsWith('http')) {
                            displayValue = `<a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a>`;
                        }
                        // Make emails clickable
                        else if (system === 'email' || value.includes('@')) {
                            displayValue = `<a href="mailto:${value}">${value}</a>`;
                        }
                        
                        contactHtml += `<div class="contact-field"><strong>${system.charAt(0).toUpperCase() + system.slice(1)}:</strong> ${displayValue}${use}</div>`;
                    }
                });
            }
            
            contactHtml += '</div>';
            
            // Add separator between multiple contacts
            if (index < contacts.length - 1) {
                contactHtml += '<hr class="contact-separator">';
            }
        });
        
        contactHtml += '</div>';
        return contactHtml;
    }

    renderResources() {
        const resourcesTab = document.getElementById('resources-tab');
        const resources = this.capabilityData.rest?.[0]?.resource || [];
        
        if (resources.length === 0) {
            resourcesTab.innerHTML = '<p>No resources found in this CapabilityStatement.</p>';
            return;
        }

        const resourcesHtml = resources.map((resource, index) => {
            const interactions = resource.interaction?.map(i => i.code).join(', ') || 'None';
            const searchParams = resource.searchParam?.map(p => p.name).join(', ') || 'None';
            
            return `
                <div class="resource-card">
                    <div class="resource-header" onclick="this.parentElement.querySelector('.resource-content').classList.toggle('active'); this.querySelector('.toggle').textContent = this.querySelector('.toggle').textContent === '+' ? '−' : '+';">
                        <h3>${resource.type}</h3>
                        <span class="toggle">+</span>
                    </div>
                    <div class="resource-content">
                        <div><strong>Profile:</strong> ${resource.profile || 'Not specified'}</div>
                        <div><strong>Supported Interactions:</strong></div>
                        <div class="interaction-list">
                            ${resource.interaction?.map(i => `<span class="interaction-tag">${i.code}</span>`).join('') || '<span>None</span>'}
                        </div>
                        ${resource.searchParam ? `
                            <div class="search-params">
                                <strong>Search Parameters:</strong>
                                ${resource.searchParam.map(p => `
                                    <div class="search-param">
                                        <strong>${p.name}</strong> (${p.type}) - ${p.documentation || 'No documentation'}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${resource.versioning ? `<div><strong>Versioning:</strong> ${resource.versioning}</div>` : ''}
                        ${resource.readHistory !== undefined ? `<div><strong>Read History:</strong> ${resource.readHistory}</div>` : ''}
                        ${resource.updateCreate !== undefined ? `<div><strong>Update Create:</strong> ${resource.updateCreate}</div>` : ''}
                        ${resource.conditionalCreate !== undefined ? `<div><strong>Conditional Create:</strong> ${resource.conditionalCreate}</div>` : ''}
                        ${resource.conditionalRead ? `<div><strong>Conditional Read:</strong> ${resource.conditionalRead}</div>` : ''}
                        ${resource.conditionalUpdate !== undefined ? `<div><strong>Conditional Update:</strong> ${resource.conditionalUpdate}</div>` : ''}
                        ${resource.conditionalDelete ? `<div><strong>Conditional Delete:</strong> ${resource.conditionalDelete}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        resourcesTab.innerHTML = `
            <h3>Supported Resources (${resources.length})</h3>
            <div class="resource-grid">
                ${resourcesHtml}
            </div>
        `;
    }

    renderInteractions() {
        const interactionsTab = document.getElementById('interactions-tab');
        const rest = this.capabilityData.rest?.[0];
        
        if (!rest) {
            interactionsTab.innerHTML = '<p>No REST interface information found.</p>';
            return;
        }

        let interactionsHtml = `
            <h3>System-Level Interactions</h3>
            <div class="interaction-list">
                ${rest.interaction?.map(i => `<span class="interaction-tag">${i.code}</span>`).join('') || '<span>None specified</span>'}
            </div>
        `;

        if (rest.mode) {
            interactionsHtml += `<div style="margin-top: 1rem;"><strong>Mode:</strong> ${rest.mode}</div>`;
        }

        if (rest.documentation) {
            interactionsHtml += `<div style="margin-top: 1rem;"><strong>Documentation:</strong> ${rest.documentation}</div>`;
        }

        // Collect all resource-level interactions
        const resourceInteractions = {};
        rest.resource?.forEach(resource => {
            resource.interaction?.forEach(interaction => {
                if (!resourceInteractions[interaction.code]) {
                    resourceInteractions[interaction.code] = [];
                }
                resourceInteractions[interaction.code].push(resource.type);
            });
        });

        if (Object.keys(resourceInteractions).length > 0) {
            interactionsHtml += `
                <h3 style="margin-top: 2rem;">Resource-Level Interactions</h3>
                ${Object.entries(resourceInteractions).map(([interaction, resources]) => `
                    <div style="margin: 1rem 0;">
                        <strong>${interaction}:</strong> ${resources.join(', ')}
                    </div>
                `).join('')}
            `;
        }

        interactionsTab.innerHTML = interactionsHtml;
    }

    renderOperations() {
        const operationsTab = document.getElementById('operations-tab');
        const rest = this.capabilityData.rest?.[0];
        
        if (!rest?.operation && !rest?.resource?.some(r => r.operation)) {
            operationsTab.innerHTML = '<p>No operations found in this CapabilityStatement.</p>';
            return;
        }

        let operationsHtml = '';

        // System-level operations
        if (rest.operation?.length > 0) {
            operationsHtml += `
                <h3>System-Level Operations</h3>
                <div class="resource-grid">
                    ${rest.operation.map(op => `
                        <div class="resource-card">
                            <div class="resource-header">
                                <h3>$${op.name}</h3>
                            </div>
                            <div class="resource-content active">
                                <div><strong>Definition:</strong> ${op.definition}</div>
                                ${op.documentation ? `<div><strong>Documentation:</strong> ${op.documentation}</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Resource-level operations
        const resourceOps = rest.resource?.filter(r => r.operation?.length > 0) || [];
        if (resourceOps.length > 0) {
            operationsHtml += `
                <h3>Resource-Level Operations</h3>
                <div class="resource-grid">
                    ${resourceOps.map(resource => `
                        <div class="resource-card">
                            <div class="resource-header" onclick="this.parentElement.querySelector('.resource-content').classList.toggle('active'); this.querySelector('.toggle').textContent = this.querySelector('.toggle').textContent === '+' ? '−' : '+';">
                                <h3>${resource.type} Operations</h3>
                                <span class="toggle">+</span>
                            </div>
                            <div class="resource-content">
                                ${resource.operation.map(op => `
                                    <div style="margin: 1rem 0; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                                        <strong>$${op.name}</strong><br>
                                        <div><strong>Definition:</strong> ${op.definition}</div>
                                        ${op.documentation ? `<div><strong>Documentation:</strong> ${op.documentation}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        operationsTab.innerHTML = operationsHtml || '<p>No operations found.</p>';
    }

    renderSearchParameters() {
        const searchTab = document.getElementById('search-tab');
        const resources = this.capabilityData.rest?.[0]?.resource || [];
        
        const resourcesWithSearch = resources.filter(r => r.searchParam?.length > 0);
        
        if (resourcesWithSearch.length === 0) {
            searchTab.innerHTML = '<p>No search parameters found in this CapabilityStatement.</p>';
            return;
        }

        const searchHtml = resourcesWithSearch.map(resource => `
            <div class="resource-card">
                <div class="resource-header" onclick="this.parentElement.querySelector('.resource-content').classList.toggle('active'); this.querySelector('.toggle').textContent = this.querySelector('.toggle').textContent === '+' ? '−' : '+';">
                    <h3>${resource.type} (${resource.searchParam.length} parameters)</h3>
                    <span class="toggle">+</span>
                </div>
                <div class="resource-content">
                    <div class="search-params">
                        ${resource.searchParam.map(param => `
                            <div class="search-param">
                                <strong>${param.name}</strong> 
                                <span style="color: #666;">(${param.type})</span>
                                ${param.documentation ? `<br><small>${param.documentation}</small>` : ''}
                                ${param.definition ? `<br><small>Definition: ${param.definition}</small>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        searchTab.innerHTML = `
            <h3>Search Parameters by Resource</h3>
            <div class="resource-grid">
                ${searchHtml}
            </div>
        `;
    }

    renderSecurity() {
        const securityTab = document.getElementById('security-tab');
        const rest = this.capabilityData.rest?.[0];
        
        if (!rest?.security) {
            securityTab.innerHTML = '<p>No security information found in this CapabilityStatement.</p>';
            return;
        }

        const security = rest.security;
        let securityHtml = '';

        if (security.cors !== undefined) {
            securityHtml += `<div><strong>CORS:</strong> ${security.cors}</div>`;
        }

        if (security.service?.length > 0) {
            securityHtml += `
                <div style="margin-top: 1rem;">
                    <strong>Security Services:</strong>
                    <div class="interaction-list">
                        ${security.service.map(service => 
                            `<span class="interaction-tag">${service.coding?.[0]?.display || service.text || 'Unknown'}</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }

        if (security.description) {
            securityHtml += `<div style="margin-top: 1rem;"><strong>Description:</strong> ${security.description}</div>`;
        }

        securityTab.innerHTML = securityHtml || '<p>No detailed security information available.</p>';
    }

    renderTesting() {
        const testingTab = document.getElementById('testing-tab');
        
        if (!testingTab) {
            console.error('Testing tab element not found');
            return;
        }
        
        const baseUrl = document.getElementById('fhir-url').value.trim().replace('/metadata', '');
        
        if (!baseUrl) {
            testingTab.innerHTML = '<div style="padding: 2rem;"><p>Please load a CapabilityStatement first to enable testing.</p></div>';
            return;
        }

        // Simple test to ensure the tab works
        testingTab.innerHTML = `
            <div style="padding: 2rem;">
                <h3>FHIR Endpoint Testing</h3>
                <p>Base URL: <strong>${baseUrl}</strong></p>
                <p>Testing functionality is being loaded...</p>
                
                <div style="margin-top: 2rem;">
                    <h4>Authentication</h4>
                    <div style="margin: 1rem 0;">
                        <label for="bearer-token" style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Bearer Token:</label>
                        <input type="password" id="bearer-token" placeholder="Enter your Bearer token" style="width: 100%; padding: 0.75rem; border: 2px solid #e1e8ed; border-radius: 6px;">
                        <small style="display: block; margin-top: 0.25rem; color: #666;">
                            <strong>Note:</strong> Bearer tokens only work with direct connections. If CORS blocks the request, 
                            the app will fall back to a proxy which cannot include authentication headers for security reasons.
                        </small>
                    </div>
                </div>
                
                <div style="margin-top: 2rem;">
                    <h4>Automated Testing Workflow</h4>
                    <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 6px; padding: 1rem; margin-bottom: 1rem; font-size: 0.9rem;">
                        <strong>🚀 Full FHIR Testing Sequence:</strong><br>
                        This will automatically run a complete FHIR workflow if the server supports it:
                        <ol style="margin: 0.5rem 0; padding-left: 1.5rem;">
                            <li><strong>Connection Test:</strong> Search for patients</li>
                            <li><strong>Read Test:</strong> Read first patient found by ID</li>
                            <li><strong>Create Test:</strong> Create a new test patient (if supported)</li>
                            <li><strong>Read Created:</strong> Read the newly created patient</li>
                            <li><strong>Update Test:</strong> Update the test patient (if supported)</li>
                            <li><strong>Delete Test:</strong> Clean up test patient (if supported)</li>
                        </ol>
                    </div>
                    <button onclick="window.fhirTester.runFullWorkflow('${baseUrl}')" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 0.5rem;">
                        🧪 Run Full FHIR Workflow
                    </button>
                    <h4 style="margin-top: 2rem;">Individual Tests</h4>
                    <div style="background: #f8f9fa; border: 1px solid #e1e8ed; border-radius: 6px; padding: 1rem; margin-bottom: 1rem; font-size: 0.9rem;">
                        <strong>How Authentication Testing Works:</strong>
                        <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                            <li><strong>With Token:</strong> Tries direct connection to your FHIR server</li>
                            <li><strong>CORS Blocked:</strong> Cannot use proxy with tokens (security limitation)</li>
                            <li><strong>Without Token:</strong> Falls back to CORS proxy for unauthenticated testing</li>
                        </ul>
                        <div style="margin-top: 0.75rem; padding: 0.75rem; background: #e7f3ff; border-left: 3px solid #0066cc; font-size: 0.85rem;">
                            <strong>💡 Common FHIR Server Configuration:</strong><br>
                            Many FHIR servers are configured to work with server-to-server API calls (backend applications) 
                            but block direct browser requests due to CORS policies. This is normal and secure. 
                            Your server may work perfectly with Postman, curl, or backend applications while blocking browser-based tools like this one.
                        </div>
                        <div style="margin-top: 0.75rem; padding: 0.75rem; background: #fff3cd; border-left: 3px solid #ffc107; font-size: 0.85rem;">
                            <strong>⚠️ Browser-Based Testing Limitations:</strong><br>
                            This tool runs entirely in your browser and cannot bypass CORS restrictions. 
                            For authenticated FHIR testing with servers that block CORS, you would need:
                            <ul style="margin: 0.25rem 0; padding-left: 1.5rem;">
                                <li>A server-hosted version of this tool (same domain as FHIR server)</li>
                                <li>A backend proxy service that forwards requests with authentication</li>
                                <li>FHIR server admin to configure CORS headers</li>
                            </ul>
                        </div>
                    </div>
                    <button onclick="window.fhirTester.testConnection('${baseUrl}')" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #04A454 0%, #038a47 100%); color: white; border: none; border-radius: 6px; cursor: pointer;">
                        🔍 Test Connection
                    </button>
                </div>
                
                <div style="margin-top: 2rem;">
                    <div id="results-header" style="display: none; cursor: pointer; padding: 1rem; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; user-select: none;" onclick="window.fhirTester.toggleResults()">
                        <h4 style="margin: 0; display: flex; align-items: center; justify-content: space-between;">
                            <span>🧪 Test Results</span>
                            <span id="results-toggle" style="font-size: 0.8em;">▼ Click to expand</span>
                        </h4>
                        <p id="results-summary" style="margin: 0.5rem 0 0 0; font-size: 0.9em; color: #666;"></p>
                    </div>
                    <div id="testing-results" style="display: none; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 6px 6px; padding: 1rem; background: #fff;"></div>
                </div>
            </div>
        `;
        
        // Store reference to this instance for global access
        window.fhirTester = this;
        
        console.log('Testing tab rendered successfully');
    }

    toggleResults() {
        const resultsDiv = document.getElementById('testing-results');
        const toggle = document.getElementById('results-toggle');
        
        if (resultsDiv.style.display === 'none') {
            resultsDiv.style.display = 'block';
            toggle.textContent = '▲ Click to collapse';
        } else {
            resultsDiv.style.display = 'none';
            toggle.textContent = '▼ Click to expand';
        }
    }

    showTestingResults() {
        const headerDiv = document.getElementById('results-header');
        const resultsDiv = document.getElementById('testing-results');
        const toggle = document.getElementById('results-toggle');
        
        if (headerDiv) {
            headerDiv.style.display = 'block';
        }
        if (resultsDiv) {
            resultsDiv.style.display = 'block';
        }
        if (toggle) {
            toggle.textContent = '▲ Click to collapse';
        }
    }

    hideTestingResults() {
        const resultsDiv = document.getElementById('testing-results');
        const toggle = document.getElementById('results-toggle');
        
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
        if (toggle) {
            toggle.textContent = '▼ Click to expand';
        }
    }

    updateResultsSummary() {
        const resultsContainer = document.getElementById('testing-results');
        const summaryElement = document.getElementById('results-summary');
        
        if (!resultsContainer || !summaryElement) return;
        
        const results = resultsContainer.children;
        let successCount = 0;
        let errorCount = 0;
        
        for (let result of results) {
            if (result.textContent.includes('✅')) successCount++;
            if (result.textContent.includes('❌')) errorCount++;
        }
        
        if (results.length === 0) {
            summaryElement.textContent = 'No tests run yet';
        } else {
            summaryElement.textContent = `${results.length} tests: ${successCount} passed, ${errorCount} failed`;
        }
    }

    async runFullWorkflow(baseUrl) {
        const token = document.getElementById('bearer-token').value.trim();
        
        // Clear previous results and show workflow header
        document.getElementById('testing-results').innerHTML = '';
        this.addTestResult('Full FHIR Workflow', true, 'Starting comprehensive FHIR server testing...');
        
        let firstPatientId = null;
        let createdPatientId = null;
        
        // Step 1: Connection Test - Search for patients
        this.addTestResult('Workflow Step 1', true, 'Starting connection test...');
        const searchResult = await this.performFhirWorkflowRequest('GET', `${baseUrl}/Patient?_count=5`, token);
        
        if (searchResult.success && searchResult.data && searchResult.data.entry && searchResult.data.entry.length > 0) {
            firstPatientId = searchResult.data.entry[0].resource.id;
            this.addTestResult('Search Patients', true, `Found ${searchResult.data.entry.length} patients. First patient ID: ${firstPatientId}`, searchResult.data);
            
            // Step 2: Read Test - Read first patient by ID
            if (firstPatientId) {
                const readResult = await this.performFhirWorkflowRequest('GET', `${baseUrl}/Patient/${firstPatientId}`, token);
                if (readResult.success) {
                    this.addTestResult('Read Patient', true, `Successfully read Patient/${firstPatientId}`, readResult.data);
                } else {
                    this.addTestResult('Read Patient', false, `Failed to read Patient/${firstPatientId}`, readResult.data);
                }
            }
        } else {
            this.addTestResult('Search Patients', false, 'No patients found or search failed', searchResult.data);
        }
        
        // Step 3: Create Test - Create a new patient
        const patientData = {
            "resourceType": "Patient",
            "name": [{
                "family": "TestPatient",
                "given": ["FHIR", "Workflow"]
            }],
            "gender": "unknown",
            "birthDate": "2000-01-01",
            "identifier": [{
                "system": "http://example.org/fhir-testing",
                "value": "WORKFLOW-TEST-" + Date.now()
            }]
        };
        
        const createResult = await this.performFhirWorkflowRequest('POST', `${baseUrl}/Patient`, token, patientData);
        
        if (createResult.success && createResult.data && createResult.data.id) {
            createdPatientId = createResult.data.id;
            this.addTestResult('Create Patient', true, `Successfully created Patient/${createdPatientId}`, createResult.data);
            
            // Step 4: Read Created - Read the newly created patient
            const readCreatedResult = await this.performFhirWorkflowRequest('GET', `${baseUrl}/Patient/${createdPatientId}`, token);
            if (readCreatedResult.success) {
                this.addTestResult('Read Created Patient', true, `Successfully read newly created Patient/${createdPatientId}`, readCreatedResult.data);
                
                // Step 5: Update Test - Update the created patient
                const updatedPatientData = { ...readCreatedResult.data };
                updatedPatientData.name[0].given = ["FHIR", "Workflow", "UPDATED"];
                
                const updateResult = await this.performFhirWorkflowRequest('PUT', `${baseUrl}/Patient/${createdPatientId}`, token, updatedPatientData);
                if (updateResult.success) {
                    this.addTestResult('Update Patient', true, `Successfully updated Patient/${createdPatientId}`, updateResult.data);
                } else {
                    this.addTestResult('Update Patient', false, `Failed to update Patient/${createdPatientId}`, updateResult.data);
                }
                
                // Step 6: Delete Test - Clean up the test patient
                const deleteResult = await this.performFhirWorkflowRequest('DELETE', `${baseUrl}/Patient/${createdPatientId}`, token);
                if (deleteResult.success) {
                    this.addTestResult('Delete Patient', true, `Successfully deleted test Patient/${createdPatientId}`, deleteResult.data);
                } else {
                    this.addTestResult('Delete Patient', false, `Failed to delete test Patient/${createdPatientId}`, deleteResult.data);
                }
            } else {
                this.addTestResult('Read Created Patient', false, `Failed to read created Patient/${createdPatientId}`, readCreatedResult.data);
            }
        } else {
            this.addTestResult('Create Patient', false, 'Failed to create test patient or server does not support create', createResult.data);
        }
        
        this.addTestResult('Workflow Complete', true, '🎉 Full FHIR workflow testing completed!');
    }

    async performFhirWorkflowRequest(method, url, token, data = null) {
        const headers = {
            'Accept': 'application/fhir+json',
            'Content-Type': 'application/fhir+json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const options = {
            method: method,
            headers: headers,
            mode: 'cors'
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            let responseData = null;
            
            const responseText = await response.text();
            if (responseText) {
                try {
                    responseData = JSON.parse(responseText);
                } catch (parseError) {
                    responseData = { rawResponse: responseText };
                }
            }
            
            return {
                success: response.ok,
                status: response.status,
                data: responseData
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    async testConnection(baseUrl) {
        const token = document.getElementById('bearer-token').value.trim();
        
        const headers = {
            'Accept': 'application/fhir+json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const testUrl = `${baseUrl}/Patient?_count=1`;
        
        try {
            // First, try direct fetch
            let response;
            let responseData;
            
            try {
                response = await fetch(testUrl, {
                    method: 'GET',
                    headers: headers,
                    mode: 'cors'
                });
                
                const responseText = await response.text();
                try {
                    responseData = responseText ? JSON.parse(responseText) : {};
                } catch (parseError) {
                    responseData = { rawResponse: responseText };
                }
                
                this.addTestResult('Connection Test', response.ok, `Direct: GET ${testUrl}`, responseData, response.status);
                
            } catch (corsError) {
                console.log('Direct test failed, trying CORS proxy...', corsError);
                
                // If direct fetch fails due to CORS, try using a CORS proxy
                // Note: CORS proxy won't include Authorization headers for security reasons
                if (token) {
                    this.addTestResult('Connection Test', false, 
                        `CORS Policy Blocks Authenticated Testing`,
                        {
                            issue: "The FHIR server blocks cross-origin requests from this domain",
                            authentication: "Bearer tokens cannot be sent through CORS proxies for security reasons",
                            explanation: "This is common - many FHIR servers work with server-to-server calls (Postman, curl, backend apps) but block browser requests",
                            solutions: [
                                "✅ Your FHIR server likely works fine with backend applications",
                                "Ask your FHIR server admin to add CORS headers for browser testing",
                                "Run this tool from the same domain as your FHIR server", 
                                "Use a browser extension to disable CORS (development only)",
                                "Test basic connectivity using the button below (no authentication)"
                            ],
                            technicalDetails: `Direct fetch error: ${corsError.message}`
                        }
                    );
                    
                    // Add a test without token button
                    setTimeout(() => {
                        const resultsContainer = document.getElementById('testing-results');
                        if (resultsContainer && resultsContainer.lastChild) {
                            const testWithoutTokenBtn = document.createElement('button');
                            testWithoutTokenBtn.innerHTML = '🔄 Test Without Token (via Proxy)';
                            testWithoutTokenBtn.style.cssText = `
                                margin-top: 1rem;
                                padding: 0.5rem 1rem;
                                background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 0.9rem;
                            `;
                            testWithoutTokenBtn.onclick = () => {
                                document.getElementById('bearer-token').value = '';
                                this.testConnection(baseUrl);
                            };
                            resultsContainer.lastChild.appendChild(testWithoutTokenBtn);
                        }
                    }, 100);
                    return;
                }
                
                try {
                    const proxyUrl = 'https://api.allorigins.win/get?url=';
                    const proxiedUrl = proxyUrl + encodeURIComponent(testUrl);
                    
                    response = await fetch(proxiedUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`Proxy request failed: HTTP ${response.status}: ${response.statusText}`);
                    }

                    const proxyResponse = await response.json();
                    
                    if (proxyResponse.status && proxyResponse.status.http_code !== 200) {
                        this.addTestResult('Connection Test', false, `Proxy: FHIR server returned HTTP ${proxyResponse.status.http_code}`, proxyResponse, proxyResponse.status.http_code);
                        return;
                    }
                    
                    try {
                        responseData = JSON.parse(proxyResponse.contents);
                        this.addTestResult('Connection Test', true, `Proxy: GET ${testUrl}`, responseData, proxyResponse.status?.http_code || 200);
                    } catch (parseError) {
                        this.addTestResult('Connection Test', false, `Proxy: Invalid JSON response from server`, { rawResponse: proxyResponse.contents });
                    }
                    
                } catch (proxyError) {
                    this.addTestResult('Connection Test', false, `Both direct and proxy requests failed. Direct error: ${corsError.message}. Proxy error: ${proxyError.message}`);
                }
            }
            
        } catch (error) {
            this.addTestResult('Connection Test', false, `Unexpected error: ${error.message}`);
        }
    }

    async performRead(baseUrl) {
        const token = document.getElementById('bearer-token').value.trim();
        const patientId = document.getElementById('patient-id').value.trim();
        
        if (!patientId) {
            this.addTestResult('Read Test', false, 'Patient ID is required');
            return;
        }
        
        const readResult = await this.performFhirWorkflowRequest('GET', `${baseUrl}/Patient/${patientId}`, token);
        
        if (readResult.success) {
            this.addTestResult('Read Patient', true, `Successfully read Patient/${patientId}`, readResult.data, readResult.status);
        } else {
            this.addTestResult('Read Patient', false, `Failed to read Patient/${patientId}: ${readResult.error || 'Unknown error'}`, readResult.data, readResult.status);
        }
    }

    async performCreate(baseUrl) {
        const token = document.getElementById('bearer-token').value.trim();
        
        const testPatient = {
            resourceType: "Patient",
            name: [{
                use: "official",
                family: "Doe",
                given: ["John"]
            }],
            gender: "male",
            birthDate: "1990-01-01",
            identifier: [{
                system: "http://example.org/patient-ids",
                value: `test-${Date.now()}`
            }]
        };

        const createResult = await this.performFhirWorkflowRequest('POST', `${baseUrl}/Patient`, token, testPatient);
        
        if (createResult.success) {
            this.addTestResult('Create Patient', true, 'Successfully created test patient', createResult.data, createResult.status);
            
            // Extract the created patient ID for further testing
            if (createResult.data && createResult.data.id) {
                const createdId = createResult.data.id;
                document.getElementById('patient-id').value = createdId;
                this.addTestResult('Patient ID', true, `Created patient ID: ${createdId} (auto-filled in Patient ID field)`);
            }
        } else {
            this.addTestResult('Create Patient', false, `Failed to create patient: ${createResult.error || 'Unknown error'}`, createResult.data, createResult.status);
        }
    }

    async performUpdate(baseUrl) {
        const token = document.getElementById('bearer-token').value.trim();
        const patientId = document.getElementById('patient-id').value.trim();
        
        if (!patientId) {
            this.addTestResult('Update Test', false, 'Patient ID is required');
            return;
        }

        // First read the current patient
        const readResult = await this.performFhirWorkflowRequest('GET', `${baseUrl}/Patient/${patientId}`, token);
        
        if (!readResult.success) {
            this.addTestResult('Update Patient', false, `Cannot update - failed to read Patient/${patientId}: ${readResult.error}`, readResult.data, readResult.status);
            return;
        }

        // Modify the patient data
        const patient = readResult.data;
        patient.name = patient.name || [];
        patient.name[0] = patient.name[0] || {};
        patient.name[0].family = patient.name[0].family + '-Updated';

        const updateResult = await this.performFhirWorkflowRequest('PUT', `${baseUrl}/Patient/${patientId}`, token, patient);
        
        if (updateResult.success) {
            this.addTestResult('Update Patient', true, `Successfully updated Patient/${patientId}`, updateResult.data, updateResult.status);
        } else {
            this.addTestResult('Update Patient', false, `Failed to update Patient/${patientId}: ${updateResult.error || 'Unknown error'}`, updateResult.data, updateResult.status);
        }
    }

    addTestResult(operation, success, message, data = null, status = null) {
        const resultsContainer = document.getElementById('testing-results');
        
        if (!resultsContainer) {
            console.error('Testing results container not found');
            return;
        }
        
        // Show results section if not already visible
        this.showTestingResults();
        
        // Auto-expand on errors only
        if (!success) {
            const resultsDiv = document.getElementById('testing-results');
            const toggle = document.getElementById('results-toggle');
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
            }
            if (toggle) {
                toggle.textContent = '▲ Click to collapse';
            }
        }
        
        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = `
            background: ${success ? '#d4edda' : '#f8d7da'};
            border: 1px solid ${success ? '#c3e6cb' : '#f5c6cb'};
            color: ${success ? '#155724' : '#721c24'};
            border-radius: 6px;
            padding: 1rem;
            margin: 0.5rem 0;
        `;
        
        const resultId = `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        let resultHtml = `
            <strong>${operation} ${success ? '✅' : '❌'}</strong>
            ${status ? `<span style="float: right;">HTTP ${status}</span>` : ''}
            <br>
            <small>${message}</small>
        `;
        
        if (data) {
            const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            const truncatedJson = jsonString.length > 2000 ? jsonString.substring(0, 2000) + '\n... (truncated)' : jsonString;
            const isExpanded = !success; // Show by default for errors, hide for success
            
            resultHtml += `
                <div style="margin-top: 0.5rem;">
                    <div onclick="window.fhirTester.toggleJsonData('${resultId}')" style="cursor: pointer; padding: 0.25rem 0; color: #666; font-size: 0.9rem; user-select: none;">
                        <span id="${resultId}-toggle">${isExpanded ? '▼' : '▶'}</span> 
                        ${isExpanded ? 'Hide' : 'Show'} Response Data
                    </div>
                    <pre id="${resultId}-data" style="background: #fff; padding: 0.75rem; border-radius: 4px; overflow-x: auto; font-size: 0.85rem; border: 1px solid #e1e8ed; max-height: 300px; overflow-y: auto; display: ${isExpanded ? 'block' : 'none'};">${truncatedJson}</pre>
                </div>
            `;
        }
        
        resultDiv.innerHTML = resultHtml;
        resultsContainer.appendChild(resultDiv);
        
        // Update the results summary
        this.updateResultsSummary();
        
        // Scroll to the new result only if results are visible
        const resultsDiv = document.getElementById('testing-results');
        if (resultsDiv.style.display !== 'none') {
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    toggleJsonData(resultId) {
        const dataElement = document.getElementById(`${resultId}-data`);
        const toggleElement = document.getElementById(`${resultId}-toggle`);
        
        if (dataElement && toggleElement) {
            const isVisible = dataElement.style.display !== 'none';
            const toggleContainer = toggleElement.parentElement;
            
            if (isVisible) {
                dataElement.style.display = 'none';
                toggleElement.textContent = '▶';
                toggleContainer.innerHTML = `<span id="${resultId}-toggle">▶</span> Show Response Data`;
                toggleContainer.onclick = () => window.fhirTester.toggleJsonData(resultId);
            } else {
                dataElement.style.display = 'block';
                toggleElement.textContent = '▼';
                toggleContainer.innerHTML = `<span id="${resultId}-toggle">▼</span> Hide Response Data`;
                toggleContainer.onclick = () => window.fhirTester.toggleJsonData(resultId);
            }
        }
    }

    renderSearchTest(baseUrl) {
        return `
            <div class="testing-section">
                <div class="testing-section-header">
                    <h3>Search Test</h3>
                </div>
                <div class="testing-section-content">
                    <div class="testing-form">
                        <div class="testing-form-group">
                            <label for="search-params">Search Parameters (optional)</label>
                            <input type="text" id="search-params" placeholder="e.g., family=Smith&given=John">
                            <small>Leave empty to search for all patients (may be limited by server)</small>
                        </div>
                        <div class="testing-buttons">
                            <button class="testing-button" onclick="window.fhirTester.performSearch('${baseUrl}')">
                                🔍 Search Patients
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderReadTest(baseUrl) {
        return `
            <div class="testing-section">
                <div class="testing-section-header">
                    <h3>Read Test</h3>
                </div>
                <div class="testing-section-content">
                    <div class="testing-form">
                        <div class="testing-form-group">
                            <label for="patient-id">Patient ID</label>
                            <input type="text" id="patient-id" placeholder="Enter Patient ID">
                            <small>Enter a valid Patient ID to read</small>
                        </div>
                        <div class="testing-buttons">
                            <button class="testing-button" onclick="window.fhirTester.performRead('${baseUrl}')">
                                📖 Read Patient
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderCreateTest(baseUrl) {
        return `
            <div class="testing-section">
                <div class="testing-section-header">
                    <h3>Create Test</h3>
                </div>
                <div class="testing-section-content">
                    <div class="testing-form">
                        <div class="testing-form-group">
                            <label for="patient-json">Patient JSON</label>
                            <textarea id="patient-json" placeholder="Enter Patient resource JSON">${this.getDefaultPatientJson()}</textarea>
                            <small>Modify the JSON above to create a new patient</small>
                        </div>
                        <div class="testing-buttons">
                            <button class="testing-button" onclick="window.fhirTester.performCreate('${baseUrl}')">
                                ✅ Create Patient
                            </button>
                            <button class="testing-button secondary" onclick="window.fhirTester.resetPatientJson()">
                                🔄 Reset JSON
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderUpdateTest(baseUrl) {
        return `
            <div class="testing-section">
                <div class="testing-section-header">
                    <h3>Update Test</h3>
                </div>
                <div class="testing-section-content">
                    <div class="testing-form">
                        <div class="testing-form-group">
                            <label for="update-patient-id">Patient ID to Update</label>
                            <input type="text" id="update-patient-id" placeholder="Enter Patient ID">
                        </div>
                        <div class="testing-form-group">
                            <label for="update-patient-json">Updated Patient JSON</label>
                            <textarea id="update-patient-json" placeholder="Enter updated Patient resource JSON">${this.getDefaultPatientJson()}</textarea>
                            <small>Make sure to include the correct ID in the JSON</small>
                        </div>
                        <div class="testing-buttons">
                            <button class="testing-button" onclick="window.fhirTester.performUpdate('${baseUrl}')">
                                ✏️ Update Patient
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderDeleteTest(baseUrl) {
        return `
            <div class="testing-section">
                <div class="testing-section-header">
                    <h3>Delete Test</h3>
                </div>
                <div class="testing-section-content">
                    <div class="testing-form">
                        <div class="testing-form-group">
                            <label for="delete-patient-id">Patient ID to Delete</label>
                            <input type="text" id="delete-patient-id" placeholder="Enter Patient ID">
                            <small style="color: #dc3545;">⚠️ This will permanently delete the patient record!</small>
                        </div>
                        <div class="testing-buttons">
                            <button class="testing-button" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);" onclick="window.fhirTester.performDelete('${baseUrl}')">
                                🗑️ Delete Patient
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getDefaultPatientJson() {
        return JSON.stringify({
            "resourceType": "Patient",
            "name": [{
                "family": "Doe",
                "given": ["John", "Test"]
            }],
            "gender": "male",
            "birthDate": "1990-01-01",
            "identifier": [{
                "system": "http://example.org/patient-ids",
                "value": "TEST-" + Date.now()
            }]
        }, null, 2);
    }

    attachTestingEventListeners() {
        // Store reference to this instance for global access
        window.fhirTester = this;
    }

    async performSearch(baseUrl) {
        const token = document.getElementById('bearer-token').value.trim();
        const searchParams = document.getElementById('search-params').value.trim();
        
        let url = `${baseUrl}/Patient`;
        if (searchParams) {
            url += `?${searchParams}`;
        }
        
        await this.performFhirRequest('Search', 'GET', url, token);
    }

    async performRead(baseUrl) {
        const token = document.getElementById('bearer-token').value.trim();
        const patientId = document.getElementById('patient-id').value.trim();
        
        if (!patientId) {
            this.addTestResult('Read', false, 'Patient ID is required');
            return;
        }
        
        const url = `${baseUrl}/Patient/${patientId}`;
        await this.performFhirRequest('Read', 'GET', url, token);
    }

    async performCreate(baseUrl) {
        const token = document.getElementById('bearer-token').value.trim();
        const patientJson = document.getElementById('patient-json').value.trim();
        
        if (!patientJson) {
            this.addTestResult('Create', false, 'Patient JSON is required');
            return;
        }
        
        try {
            const patientData = JSON.parse(patientJson);
            const url = `${baseUrl}/Patient`;
            await this.performFhirRequest('Create', 'POST', url, token, patientData);
        } catch (error) {
            this.addTestResult('Create', false, `Invalid JSON: ${error.message}`);
        }
    }

    async performUpdate(baseUrl) {
        const token = document.getElementById('bearer-token').value.trim();
        const patientId = document.getElementById('update-patient-id').value.trim();
        const patientJson = document.getElementById('update-patient-json').value.trim();
        
        if (!patientId) {
            this.addTestResult('Update', false, 'Patient ID is required');
            return;
        }
        
        if (!patientJson) {
            this.addTestResult('Update', false, 'Patient JSON is required');
            return;
        }
        
        try {
            const patientData = JSON.parse(patientJson);
            patientData.id = patientId; // Ensure ID matches
            const url = `${baseUrl}/Patient/${patientId}`;
            await this.performFhirRequest('Update', 'PUT', url, token, patientData);
        } catch (error) {
            this.addTestResult('Update', false, `Invalid JSON: ${error.message}`);
        }
    }

    async performDelete(baseUrl) {
        const token = document.getElementById('bearer-token').value.trim();
        const patientId = document.getElementById('delete-patient-id').value.trim();
        
        if (!patientId) {
            this.addTestResult('Delete', false, 'Patient ID is required');
            return;
        }
        
        if (!confirm(`Are you sure you want to delete Patient ${patientId}? This action cannot be undone.`)) {
            return;
        }
        
        const url = `${baseUrl}/Patient/${patientId}`;
        await this.performFhirRequest('Delete', 'DELETE', url, token);
    }

    async performFhirRequest(operation, method, url, token, data = null) {
        const headers = {
            'Accept': 'application/fhir+json',
            'Content-Type': 'application/fhir+json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const options = {
            method: method,
            headers: headers,
            mode: 'cors'
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            const responseText = await response.text();
            
            let responseData;
            try {
                responseData = responseText ? JSON.parse(responseText) : {};
            } catch (parseError) {
                responseData = { rawResponse: responseText };
            }
            
            if (response.ok) {
                this.addTestResult(operation, true, `${method} ${url}`, responseData, response.status);
            } else {
                this.addTestResult(operation, false, `${method} ${url} - HTTP ${response.status}`, responseData, response.status);
            }
        } catch (error) {
            this.addTestResult(operation, false, `${method} ${url} - ${error.message}`);
        }
    }

    resetPatientJson() {
        document.getElementById('patient-json').value = this.getDefaultPatientJson();
    }

    renderRawData() {
        const rawTab = document.getElementById('raw-tab');
        rawTab.innerHTML = `
            <h3>Raw CapabilityStatement JSON</h3>
            <div class="json-container">
                <pre>${JSON.stringify(this.capabilityData, null, 2)}</pre>
            </div>
        `;
    }

    switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        const targetPanel = document.getElementById(`${tabName}-tab`);
        if (targetPanel) {
            targetPanel.classList.add('active');
            console.log('Tab panel found and activated:', `${tabName}-tab`);
        } else {
            console.error('Tab panel not found:', `${tabName}-tab`);
        }
    }

    loadDemoData() {
        // Load from the sandbox FHIR server
        const sandboxUrl = 'https://fhirr4sandbox.webch.art/webchart.cgi/fhir/metadata';
        
        // Set the URL in the input field
        document.getElementById('fhir-url').value = sandboxUrl;
        
        // Load the CapabilityStatement from the sandbox
        this.loadCapabilityStatement();
    }

    loadStaticDemoData() {
        // Fallback static demo data if needed
        const demoData = {
            "resourceType": "CapabilityStatement",
            "id": "demo",
            "url": "https://fhirr4sandbox.webch.art/webchart.cgi/fhir/metadata",
            "version": "4.0.1",
            "name": "Sandbox_FHIR_Capability_Statement",
            "status": "active",
            "experimental": false,
            "date": "2025-10-15T20:10:00Z",
            "publisher": "WebChart FHIR R4 Sandbox",
            "contact": [{
                "name": "FHIR Support Team",
                "telecom": [{
                    "system": "url",
                    "value": "https://www.webchartnow.com/support"
                }, {
                    "system": "email",
                    "value": "fhir-support@webchartnow.com"
                }]
            }],
            "description": "This is a demonstration CapabilityStatement from the WebChart FHIR R4 Sandbox showing typical FHIR server capabilities.",
            "kind": "instance",
            "software": {
                "name": "WebChart FHIR R4 Sandbox",
                "version": "1.0.0"
            },
            "fhirVersion": "4.0.1",
            "format": ["application/fhir+json", "application/fhir+xml"],
            "rest": [{
                "mode": "server",
                "documentation": "Demo FHIR server with common resource support",
                "security": {
                    "cors": true,
                    "service": [{
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/restful-security-service",
                            "code": "SMART-on-FHIR",
                            "display": "SMART-on-FHIR"
                        }],
                        "text": "SMART-on-FHIR OAuth2"
                    }],
                    "description": "OAuth2 using SMART-on-FHIR profile"
                },
                "interaction": [
                    {"code": "transaction"},
                    {"code": "batch"},
                    {"code": "search-system"},
                    {"code": "history-system"}
                ],
                "resource": [
                    {
                        "type": "Patient",
                        "profile": "http://hl7.org/fhir/StructureDefinition/Patient",
                        "supportedProfile": [
                            "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"
                        ],
                        "interaction": [
                            {"code": "read", "documentation": "Read patient by ID"},
                            {"code": "search-type", "documentation": "Search for patients"},
                            {"code": "create", "documentation": "Create new patient"},
                            {"code": "update", "documentation": "Update existing patient"}
                        ],
                        "versioning": "versioned",
                        "readHistory": true,
                        "updateCreate": true,
                        "conditionalCreate": true,
                        "conditionalRead": "full-support",
                        "conditionalUpdate": true,
                        "conditionalDelete": "single",
                        "referencePolicy": ["literal", "logical"],
                        "searchParam": [
                            {
                                "name": "_id",
                                "definition": "http://hl7.org/fhir/SearchParameter/Resource-id",
                                "type": "token",
                                "documentation": "Logical id of this artifact"
                            },
                            {
                                "name": "identifier",
                                "definition": "http://hl7.org/fhir/SearchParameter/Patient-identifier",
                                "type": "token",
                                "documentation": "A patient identifier"
                            },
                            {
                                "name": "name",
                                "definition": "http://hl7.org/fhir/SearchParameter/Patient-name",
                                "type": "string",
                                "documentation": "A portion of the patient's name"
                            },
                            {
                                "name": "family",
                                "definition": "http://hl7.org/fhir/SearchParameter/individual-family",
                                "type": "string",
                                "documentation": "A portion of the family name"
                            },
                            {
                                "name": "given",
                                "definition": "http://hl7.org/fhir/SearchParameter/individual-given",
                                "type": "string",
                                "documentation": "A portion of the given name"
                            },
                            {
                                "name": "birthdate",
                                "definition": "http://hl7.org/fhir/SearchParameter/individual-birthdate",
                                "type": "date",
                                "documentation": "The patient's date of birth"
                            },
                            {
                                "name": "gender",
                                "definition": "http://hl7.org/fhir/SearchParameter/individual-gender",
                                "type": "token",
                                "documentation": "Gender of the patient"
                            }
                        ]
                    },
                    {
                        "type": "Observation",
                        "profile": "http://hl7.org/fhir/StructureDefinition/Observation",
                        "supportedProfile": [
                            "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab"
                        ],
                        "interaction": [
                            {"code": "read", "documentation": "Read observation by ID"},
                            {"code": "search-type", "documentation": "Search for observations"}
                        ],
                        "referencePolicy": ["literal"],
                        "searchParam": [
                            {
                                "name": "_id",
                                "definition": "http://hl7.org/fhir/SearchParameter/Resource-id",
                                "type": "token",
                                "documentation": "Logical id of this artifact"
                            },
                            {
                                "name": "patient",
                                "definition": "http://hl7.org/fhir/SearchParameter/clinical-patient",
                                "type": "reference",
                                "documentation": "The patient this observation is about"
                            },
                            {
                                "name": "code",
                                "definition": "http://hl7.org/fhir/SearchParameter/clinical-code",
                                "type": "token",
                                "documentation": "The code of the observation type"
                            },
                            {
                                "name": "date",
                                "definition": "http://hl7.org/fhir/SearchParameter/clinical-date",
                                "type": "date",
                                "documentation": "Obtained date/time"
                            },
                            {
                                "name": "category",
                                "definition": "http://hl7.org/fhir/SearchParameter/Observation-category",
                                "type": "token",
                                "documentation": "The classification of the type of observation"
                            }
                        ]
                    },
                    {
                        "type": "Condition",
                        "profile": "http://hl7.org/fhir/StructureDefinition/Condition",
                        "interaction": [
                            {"code": "read", "documentation": "Read condition by ID"},
                            {"code": "search-type", "documentation": "Search for conditions"}
                        ],
                        "referencePolicy": ["literal"],
                        "searchParam": [
                            {
                                "name": "_id",
                                "definition": "http://hl7.org/fhir/SearchParameter/Resource-id",
                                "type": "token",
                                "documentation": "Logical id of this artifact"
                            },
                            {
                                "name": "patient",
                                "definition": "http://hl7.org/fhir/SearchParameter/clinical-patient",
                                "type": "reference",
                                "documentation": "Who has the condition?"
                            },
                            {
                                "name": "code",
                                "definition": "http://hl7.org/fhir/SearchParameter/clinical-code",
                                "type": "token",
                                "documentation": "Code for the condition"
                            }
                        ]
                    }
                ],
                "operation": [
                    {
                        "name": "validate",
                        "definition": "http://hl7.org/fhir/OperationDefinition/Resource-validate",
                        "documentation": "Validate a resource"
                    }
                ]
            }]
        };

        this.hideError();
        this.hideLoading();
        
        // Set demo data and display
        this.capabilityData = demoData;
        this.displayCapabilityStatement();
    }

    checkUrlParameters() {
        // Check if there's a 'url' parameter in the current page URL
        const urlParams = new URLSearchParams(window.location.search);
        const fhirUrl = urlParams.get('url');
        
        if (fhirUrl) {
            // Decode the URL and set it in the input field
            const decodedUrl = decodeURIComponent(fhirUrl);
            document.getElementById('fhir-url').value = decodedUrl;
            
            // Automatically load the CapabilityStatement
            this.loadCapabilityStatement();
        }
    }

    generatePermalink() {
        const currentUrl = document.getElementById('fhir-url').value.trim();
        
        if (!currentUrl) {
            alert('No FHIR URL is currently loaded. Please load a CapabilityStatement first.');
            return;
        }

        // Create a permalink with the current FHIR URL as a parameter
        const baseUrl = window.location.origin + window.location.pathname;
        const permalink = `${baseUrl}?url=${encodeURIComponent(currentUrl)}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(permalink).then(() => {
            // Show temporary feedback
            const button = document.getElementById('permalink-link');
            const originalText = button.textContent;
            button.textContent = '✅ Link Copied!';
            button.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = 'linear-gradient(135deg, #6c757d 0%, #495057 100%)';
            }, 2000);
        }).catch(() => {
            // Fallback: show the URL in an alert if clipboard access fails
            alert(`Permalink copied to clipboard:\n\n${permalink}`);
        });
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FHIRCapabilityViewer();
});