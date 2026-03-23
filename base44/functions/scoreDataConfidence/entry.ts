import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { public_record_id, agent_payoff_method, agent_payoff_amount } = await req.json();
    
    if (!public_record_id) {
      return Response.json({ error: 'public_record_id required' }, { status: 400 });
    }

    const record = await base44.entities.PropertyPublicRecord.get(public_record_id);
    if (!record) {
      return Response.json({ error: 'Record not found' }, { status: 404 });
    }

    // Score ownership (30% weight)
    let ownershipScore = 0;
    let ownershipLevel = 'low';
    let ownershipNotes = '';
    
    if (!record.owner_of_record) {
      ownershipScore = 0;
      ownershipLevel = 'low';
      ownershipNotes = 'No deed found in registry';
    } else if (record.owner_verified) {
      ownershipScore = 100;
      ownershipLevel = 'high';
      ownershipNotes = 'Owner of record verified against client name';
    } else {
      ownershipScore = 75;
      ownershipLevel = 'medium';
      ownershipNotes = 'Deed found but owner name not verified against client';
    }

    // Score mortgage (30% weight)
    let mortgageScore = 0;
    let mortgageLevel = 'low';
    let mortgageNotes = '';
    const blockingConditions = [];
    const warningConditions = [];

    if (agent_payoff_method === 'actual' && agent_payoff_amount) {
      mortgageScore = 100;
      mortgageLevel = 'high';
      mortgageNotes = 'Agent provided verified payoff amount';
    } else if (!record.original_mortgage_amount) {
      if (!agent_payoff_method) {
        warningConditions.push('No mortgage records found and no payoff information provided');
        mortgageScore = 0;
        mortgageLevel = 'low';
        mortgageNotes = 'No mortgage found; agent must provide payoff or confirm free & clear';
      } else {
        mortgageScore = 40;
        mortgageLevel = 'low';
        mortgageNotes = 'Agent provided payoff without public record confirmation';
      }
    } else if (record.mortgage_discharged) {
      mortgageScore = 100;
      mortgageLevel = 'high';
      mortgageNotes = 'Mortgage discharge recorded — property free and clear';
    } else if (record.most_recent_mortgage_date) {
      const mortgageDate = new Date(record.most_recent_mortgage_date);
      const daysSince = (new Date() - mortgageDate) / (1000 * 60 * 60 * 24);
      
      if (daysSince < 365) {
        mortgageScore = 100;
        mortgageLevel = 'high';
        mortgageNotes = 'Recent refinance found, clean chain';
      } else {
        mortgageScore = 85;
        mortgageLevel = 'high';
        mortgageNotes = 'Refi found but aging; estimate may have drift';
      }
    } else {
      const origDate = new Date(record.original_mortgage_date);
      const daysSince = (new Date() - origDate) / (1000 * 60 * 60 * 24);
      
      if (daysSince > 3650) {
        warningConditions.push('Original mortgage >10 years old with no refinance on record; estimation uncertainty high');
        mortgageScore = 50;
        mortgageLevel = 'medium';
        mortgageNotes = 'Only original mortgage found, >10 years old';
      } else {
        mortgageScore = 85;
        mortgageLevel = 'high';
        mortgageNotes = 'Mortgage found and reasonably current';
      }
    }

    // Score valuation (25% weight)
    let valuationScore = 0;
    let valuationLevel = 'low';
    let valuationNotes = '';

    if (!record.assessed_value) {
      valuationScore = 0;
      valuationLevel = 'low';
      valuationNotes = 'No assessor data found; comp-based estimate only';
    } else if (record.assessed_year) {
      const yearsSince = new Date().getFullYear() - record.assessed_year;
      if (yearsSince === 0) {
        valuationScore = 100;
        valuationLevel = 'high';
        valuationNotes = `Current year assessment (${record.assessed_year})`;
      } else if (yearsSince === 1) {
        valuationScore = 85;
        valuationLevel = 'high';
        valuationNotes = `Assessment 1 year old (${record.assessed_year})`;
      } else if (yearsSince === 2) {
        warningConditions.push('Assessor data is 2+ years old; staleness may affect accuracy');
        valuationScore = 70;
        valuationLevel = 'medium';
        valuationNotes = `Assessment ${yearsSince} years old (${record.assessed_year})`;
      } else {
        warningConditions.push('Assessor data is 2+ years old; staleness may affect accuracy');
        valuationScore = 40;
        valuationLevel = 'low';
        valuationNotes = `Assessment ${yearsSince} years old; stale data`;
      }
    }

    // Score lien check (10% weight)
    let lienScore = 100;
    let lienLevel = 'high';
    let lienNotes = 'No liens found';

    if (record.liens_found) {
      warningConditions.push('Liens or encumbrances found on property; must be acknowledged');
      lienScore = 25;
      lienLevel = 'medium';
      lienNotes = `Liens found: ${record.lien_details || 'See details'}`;
    }

    // Score record freshness (5% weight)
    let freshnessScore = 0;
    let freshnessLevel = 'low';
    let freshnessNotes = '';

    if (record.searched_at) {
      const searchDate = new Date(record.searched_at);
      const daysSince = (new Date() - searchDate) / (1000 * 60 * 60 * 24);
      
      if (daysSince < 1) {
        freshnessScore = 100;
        freshnessLevel = 'high';
        freshnessNotes = 'Searched today';
      } else if (daysSince < 7) {
        freshnessScore = 85;
        freshnessLevel = 'high';
        freshnessNotes = `Searched ${Math.floor(daysSince)} days ago`;
      } else if (daysSince < 30) {
        freshnessScore = 70;
        freshnessLevel = 'medium';
        freshnessNotes = `Searched ${Math.floor(daysSince)} days ago`;
      } else {
        warningConditions.push('Public records cached >30 days; offer refresh');
        freshnessScore = 0;
        freshnessLevel = 'low';
        freshnessNotes = `Searched ${Math.floor(daysSince)} days ago; offer refresh`;
      }
    }

    // Calculate weighted overall score
    const overallScore = Math.round(
      (ownershipScore * 0.30) +
      (mortgageScore * 0.30) +
      (valuationScore * 0.25) +
      (lienScore * 0.10) +
      (freshnessScore * 0.05)
    );

    // Determine overall level and report state
    let overallLevel = 'insufficient';
    let reportState = 'red';
    
    if (overallScore >= 80) {
      overallLevel = 'high';
      reportState = 'green';
    } else if (overallScore >= 60) {
      overallLevel = 'medium';
      reportState = warningConditions.length > 0 ? 'yellow' : 'green';
    } else if (overallScore >= 40) {
      overallLevel = 'low';
      reportState = 'yellow';
    }

    // Blocking conditions
    if (ownershipScore === 0) {
      blockingConditions.push('No deed found in registry');
    }
    if (overallScore < 40) {
      blockingConditions.push('Overall data quality insufficient for reliable report');
    }

    // Missing data questions
    const missingDataQuestions = [];
    
    if (!record.owner_of_record) {
      missingDataQuestions.push({
        id: 'owner_confirmation',
        type: 'yes_no',
        question: 'Can you confirm the owner of this property?',
        explanation: 'Without ownership confirmation, we cannot reliably proceed.',
        isBlocking: true
      });
    }

    if (!record.original_mortgage_amount && !agent_payoff_method) {
      missingDataQuestions.push({
        id: 'mortgage_status',
        type: 'yes_no_unsure',
        question: 'Does your client have an outstanding mortgage on this property?',
        explanation: 'Mortgage status affects all equity scenarios.',
        isBlocking: true
      });
    }

    if (record.assessed_year && (new Date().getFullYear() - record.assessed_year) >= 2) {
      missingDataQuestions.push({
        id: 'confirm_valuation',
        type: 'yes_no',
        question: 'Do you want to proceed with the available assessment data, or would you like to get a current appraisal?',
        explanation: 'Older assessments may not reflect current market value.',
        isBlocking: false
      });
    }

    const canGenerate = blockingConditions.length === 0 && overallScore >= 40;
    const requiresAcknowledgment = warningConditions.length > 0;

    let recommendation = '';
    if (reportState === 'red') {
      recommendation = 'Cannot proceed with report generation. Address blocking conditions first.';
    } else if (reportState === 'yellow') {
      recommendation = 'Report can be generated but contains estimates. Agent must acknowledge before export.';
    } else {
      recommendation = 'High confidence. Proceed with report generation.';
    }

    const response = {
      overall_score: overallScore,
      overall_level: overallLevel,
      report_state: reportState,
      component_scores: {
        ownership: { score: ownershipScore, level: ownershipLevel, notes: ownershipNotes },
        mortgage: { score: mortgageScore, level: mortgageLevel, notes: mortgageNotes },
        valuation: { score: valuationScore, level: valuationLevel, notes: valuationNotes },
        lien_check: { score: lienScore, level: lienLevel, notes: lienNotes },
        record_freshness: { score: freshnessScore, level: freshnessLevel, notes: freshnessNotes }
      },
      blocking_conditions: blockingConditions,
      warning_conditions: warningConditions,
      missing_data_questions: missingDataQuestions,
      can_generate: canGenerate,
      requires_acknowledgment: requiresAcknowledgment,
      recommendation: recommendation
    };

    return Response.json(response);
  } catch (error) {
    console.error('[scoreDataConfidence] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});