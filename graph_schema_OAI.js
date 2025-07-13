{
  nodes: [
    {
      "label": "Country",
      "properties": [
        { "name": "code", "type": "string", "unique": true },
        { "name": "name", "type": "string" }
      ]
    },
    {
      "label": "Location",
      "properties": [
        { "name": "id", "type": "string", "unique": true },
        { "name": "name", "type": "string" },
        { "name": "type", "type": "string" },          // district, TA, village…
        { "name": "lat", "type": "float" },
        { "name": "lon", "type": "float" }
      ]
    },
    {
      "label": "Organization",
      "properties": [
        { "name": "orgId", "type": "string", "unique": true },
        { "name": "name", "type": "string" },
        { "name": "type", "type": "string" }           // utility, ministry, donor, private…
      ]
    },
    {
      "label": "Person",
      "properties": [
        { "name": "personId", "type": "string", "unique": true },
        { "name": "fullName", "type": "string" },
        { "name": "role", "type": "string" },
        { "name": "gender", "type": "string" },
        { "name": "email", "type": "string", "nullable": true }
      ]
    },
    {
      "label": "Project",
      "properties": [
        { "name": "projId", "type": "string", "unique": true },
        { "name": "name", "type": "string" },
        { "name": "status", "type": "string" },        // pipeline, ongoing, closed
        { "name": "sector", "type": "string" },        // generation, transmission, access, cooking
        { "name": "startDate", "type": "date", "nullable": true },
        { "name": "endDate", "type": "date", "nullable": true },
        { "name": "description", "type": "string", "nullable": true }
      ]
    },
    {
      "label": "ProjectComponent",
      "properties": [
        { "name": "compId", "type": "string", "unique": true },
        { "name": "name", "type": "string" },
        { "name": "capexUSD", "type": "float", "nullable": true },
        { "name": "opexUSD", "type": "float", "nullable": true },
        { "name": "currency", "type": "string", "nullable": true },
        { "name": "description", "type": "string", "nullable": true },
        { "name": "associatedProject", "type": "string", "nullable": false }
      ]
    },
    {
      "label": "Asset",
      "properties": [
        { "name": "assetId", "type": "string", "unique": true },
        { "name": "name", "type": "string" },
        { "name": "type", "type": "string" },          // plant, substation, line, stove…
        { "name": "capacityMW", "type": "float", "nullable": true },
        { "name": "commissionYear", "type": "integer", "nullable": true },
        { "name": "lat", "type": "float", "nullable": true },
        { "name": "lon", "type": "float", "nullable": true }
      ]
    },
    {
      "label": "Technology",
      "properties": [
        { "name": "techCode", "type": "string", "unique": true },
        { "name": "name", "type": "string" },
        { "name": "category", "type": "string" }       // hydro, solar, biomass…
      ]
    },
    {
      "label": "FundingSource",
      "properties": [
        { "name": "fundId", "type": "string", "unique": true },
        { "name": "name", "type": "string" },
        { "name": "type", "type": "string" },          // grant, loan, equity
        { "name": "currency", "type": "string" },
        { "name": "amount", "type": "float" },
        { "name": "approvalDate", "type": "date", "nullable": true }
      ]
    },
    {
      "label": "FinancialStatement",
      "properties": [
        { "name": "fsId", "type": "string", "unique": true },
        { "name": "orgId", "type": "string" },
        { "name": "fiscalYear", "type": "integer", "unique": true },
        { "name": "auditor", "type": "string", "nullable": true },
        { "name": "currency", "type": "string" },
        { "name": "opinion", "type": "string", "nullable": true }
      ]
    },
    {
      "label": "FinancialMetric",
      "properties": [
        { "name": "metricId", "type": "string", "unique": true },
        { "name": "name", "type": "string" },          // revenue, opex…
        { "name": "unit", "type": "string" }
      ]
    },
    {
      "label": "Scenario",
      "properties": [
        { "name": "scenId", "type": "string", "unique": true },
        { "name": "name", "type": "string" },
        { "name": "baseYear", "type": "integer" },
        { "name": "description", "type": "string", "nullable": true }
      ]
    },
    {
      "label": "DemandForecast",
      "properties": [
        { "name": "dfId", "type": "string", "unique": true },
        { "name": "year", "type": "integer" },
        { "name": "demandMW", "type": "float" },
        { "name": "elasticity", "type": "float", "nullable": true },
        { "name": "gdpGrowth", "type": "float", "nullable": true }
      ]
    },
    {
      "label": "Policy",
      "properties": [
        { "name": "policyId", "type": "string", "unique": true },
        { "name": "title", "type": "string" },
        { "name": "type", "type": "string" },          // IRP, Compact…
        { "name": "yearIssued", "type": "integer" },
        { "name": "authority", "type": "string", "nullable": true },
        { "name": "description", "type": "string", "nullable": false }
      ]
    },
    {
      "label": "Intervention",
      "properties": [
        { "name": "intvId", "type": "string", "unique": true },
        { "name": "name", "type": "string" },
        { "name": "type", "type": "string" },          // grid-ext, mini-grid, SHS…
        { "name": "costUSD", "type": "float", "nullable": true },
        { "name": "dateImplemented", "type": "date", "nullable": true }
      ]
    },
    {
      "label": "AccessTier",
      "properties": [
        { "name": "tierId", "type": "string", "unique": true },
        { "name": "tier", "type": "integer" },         // 0–5
        { "name": "energyService", "type": "string" }, // electricity, cooking
        { "name": "surveyDate", "type": "date" }
      ]
    },
    {
      "label": "RiskHazard",
      "properties": [
        { "name": "hazId", "type": "string", "unique": true },
        { "name": "hazard", "type": "string" },        // flood, drought…
        { "name": "severity", "type": "string" },
        { "name": "returnPeriod", "type": "integer", "nullable": true }
      ]
    },
    {
      "label": "SafeguardDocument",
      "properties": [
        { "name": "docId", "type": "string", "unique": true },
        { "name": "title", "type": "string" },
        { "name": "docType", "type": "string" },       // ESIA, ESCP…
        { "name": "date", "type": "date" }
      ]
    },
    {
      "label": "ImpactArea",
      "properties": [
        { "name": "impactId", "type": "string", "unique": true },
        { "name": "theme", "type": "string" }          // health, gender, climate…
      ]
    },
    {
      "label": "HouseholdSegment",
      "properties": [
        { "name": "segId", "type": "string", "unique": true },
        { "name": "name", "type": "string" },
        { "name": "population", "type": "integer", "nullable": true }
      ]
    }
  ],

  relationships: [
    {
      "type": "LOCATED_IN",
      "from": ["Location", "Asset", "Project"],
      "to": ["Country", "Location"],
      "properties": [
        { "name": "since", "type": "date", "nullable": true }
      ]
    },
    {
      "type": "IMPLEMENTED_BY",
      "from": ["Project"],
      "to": ["Organization"],
      "properties": [
        { "name": "role", "type": "string" }           // PIU, contractor…
      ]
    },
    {
      "type": "MANAGED_BY",
      "from": ["Asset"],
      "to": ["Organization"],
      "properties": [
        { "name": "since", "type": "date", "nullable": true }
      ]
    },
    {
      "type": "FUNDED_BY",
      "from": ["Project", "ProjectComponent"],
      "to": ["FundingSource"],
      "properties": [
        { "name": "pct", "type": "float", "nullable": true }
      ]
    },
    {
      "type": "HAS_COMPONENT",
      "from": ["Project"],
      "to": ["ProjectComponent"],
      "properties": []
    },
    {
      "type": "USES_TECHNOLOGY",
      "from": ["Asset", "ProjectComponent"],
      "to": ["Technology"],
      "properties": []
    },
    {
      "type": "SERVES",
      "from": ["Asset", "Intervention"],
      "to": ["Location", "HouseholdSegment"],
      "properties": [
        { "name": "startYear", "type": "integer", "nullable": true }
      ]
    },
    {
      "type": "REPORTS_ON",
      "from": ["FinancialMetric"],
      "to": ["FinancialStatement"],
      "properties": [
        { "name": "value", "type": "float" },
        { "name": "note", "type": "string", "nullable": true }
      ]
    },
    {
      "type": "FORECAST_FOR",
      "from": ["DemandForecast"],
      "to": ["Scenario"],
      "properties": []
    },
    {
      "type": "ALIGNS_WITH",
      "from": ["Project", "Intervention"],
      "to": ["Policy"],
      "properties": [
        { "name": "degree", "type": "string" }         // high, medium, low
      ]
    },
    {
      "type": "TARGETS",
      "from": ["Policy"],
      "to": ["ImpactArea"],
      "properties": [
        { "name": "kpi", "type": "string", "nullable": true },
        { "name": "targetValue", "type": "float", "nullable": true },
        { "name": "targetYear", "type": "integer", "nullable": true }
      ]
    },
    {
      "type": "TRIGGERS",
      "from": ["RiskHazard"],
      "to": ["Asset", "Project"],
      "properties": [
        { "name": "probability", "type": "float", "nullable": true },
        { "name": "expectedLossUSD", "type": "float", "nullable": true }
      ]
    },
    {
      "type": "COMPLIES_WITH",
      "from": ["Project", "ProjectComponent"],
      "to": ["SafeguardDocument"],
      "properties": [
        { "name": "status", "type": "string" }         // draft, approved…
      ]
    },
    {
      "type": "HAS_ACCESS_TIER",
      "from": ["Location", "HouseholdSegment"],
      "to": ["AccessTier"],
      "properties": []
    },
    {
      "type": "BOARD_MEMBER",
      "from": ["Person"],
      "to": ["Organization"],
      "properties": [
        { "name": "position", "type": "string" },
        { "name": "since", "type": "date", "nullable": true },
        { "name": "until", "type": "date", "nullable": true }
      ]
    },
    {
      "type": "PUBLISHED",
      "from": ["Organization"],
      "to": ["Policy"],
      "properties": [
        { "name": "date", "type": "date" }
      ]
    },
    {
      "type": "IS_PART_OF",
      "from": ["ProjectComponent", "Asset"],
      "to": ["Project"],
      "properties": []
    },
    {
      "type": "BELONGS_TO",
      "from": ["FundingSource"],
      "to": ["Organization"],
      "properties": [
        { "name": "sharePct", "type": "float", "nullable": true }
      ]
    }
  ]
}
