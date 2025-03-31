const refreshPricing = async () => {
  setIsRefreshing(true);
  setRefreshError(null);
  
  try {
    const response = await fetch('/api/admin/pricing/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      setRefreshError(result.error || 'Failed to refresh pricing data');
      console.error('Error refreshing pricing:', result);
    } else {
      // Check if we got data back even though Firestore save failed
      if (result.data && result.writeError) {
        setPricingData(result.data);
        setLastUpdated(new Date(result.timestamp));
        
        // Show a partial success message
        setMessage({
          type: 'warning',
          text: `Pricing data fetched but not saved to Firestore: ${result.writeError}. Using temporary data.`
        });
      } else {
        setMessage({
          type: 'success',
          text: `Pricing data refreshed successfully! ${result.count} countries updated.`
        });
      }
    }
  } catch (error) {
    setRefreshError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Exception refreshing pricing:', error);
  } finally {
    setIsRefreshing(false);
    loadPricingData(); // Reload from Firestore anyway
  }
}; 