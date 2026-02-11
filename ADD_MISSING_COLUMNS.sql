-- ========================================
-- Add Missing Columns to raw_events Table
-- ========================================
-- Run this in your ClickHouse client

-- 1. Add search_filter_applied (tracks filters used in search)
ALTER TABLE raw_events 
ADD COLUMN IF NOT EXISTS search_filter_applied String DEFAULT '';

-- 2. Add utm_content (for A/B testing ads)
ALTER TABLE raw_events 
ADD COLUMN IF NOT EXISTS utm_content String DEFAULT '';

-- 3. Add os if somehow missing (should already exist)
ALTER TABLE raw_events 
ADD COLUMN IF NOT EXISTS os String DEFAULT 'Unknown';

-- 4. Add screen_resolution if somehow missing (should already exist)
ALTER TABLE raw_events 
ADD COLUMN IF NOT EXISTS screen_resolution String DEFAULT '';

-- 5. Add click_count_on_element if somehow missing (should already exist)
ALTER TABLE raw_events 
ADD COLUMN IF NOT EXISTS click_count_on_element Int16 DEFAULT 0;

-- 6. Add video_interaction if somehow missing (should already exist)
ALTER TABLE raw_events 
ADD COLUMN IF NOT EXISTS video_interaction String DEFAULT '';

-- 7. Add file_download_name if somehow missing (should already exist)
ALTER TABLE raw_events 
ADD COLUMN IF NOT EXISTS file_download_name String DEFAULT '';

-- 8. Add currency_code if somehow missing (should already exist)
ALTER TABLE raw_events 
ADD COLUMN IF NOT EXISTS currency_code String DEFAULT 'USD';

-- 9. Add guest_segment if somehow missing (should already exist)
ALTER TABLE raw_events 
ADD COLUMN IF NOT EXISTS guest_segment String DEFAULT 'Unknown';

-- ========================================
-- Verify all columns exist
-- ========================================
SELECT 
    name AS column_name,
    type AS data_type,
    default_expression
FROM system.columns
WHERE table = 'raw_events' AND database = currentDatabase()
ORDER BY name;

-- ========================================
-- Check data population (which fields are actually being used)
-- ========================================
SELECT 
    COUNT(*) AS total_events,
    
    -- Page Properties
    countIf(page_url != '') AS has_page_url,
    countIf(page_category != '') AS has_page_category,
    countIf(page_title != '') AS has_page_title,
    countIf(referrer_url != '') AS has_referrer,
    
    -- Interaction Properties
    countIf(element_selector != '') AS has_element_selector,
    countIf(element_text != '') AS has_element_text,
    countIf(is_rage_click = true) AS has_rage_clicks,
    countIf(is_dead_click = true) AS has_dead_clicks,
    countIf(hover_duration_ms > 0) AS has_hover_duration,
    
    -- Engagement Properties
    countIf(scroll_depth_percent > 0) AS has_scroll_depth,
    countIf(time_on_page_seconds > 0) AS has_time_on_page,
    countIf(video_interaction != '') AS has_video_interaction,
    countIf(file_download_name != '') AS has_file_downloads,
    
    -- Form Properties
    countIf(form_field_name != '') AS has_form_interactions,
    countIf(form_validation_error != '') AS has_form_errors,
    countIf(form_autofill_detected = true) AS has_autofill,
    
    -- Booking Properties
    countIf(selected_location != '') AS has_location,
    countIf(selected_room_type != '') AS has_room_type,
    countIf(price_viewed_amount > 0) AS has_price,
    countIf(discount_code_attempted != '') AS has_discount_code,
    countIf(addon_viewed != '') AS has_addons,
    
    -- Search Properties
    countIf(search_query != '') AS has_search_query,
    countIf(search_results_count > 0) AS has_search_results,
    countIf(search_filter_applied != '') AS has_search_filters,
    
    -- Device Properties
    countIf(device_type != '') AS has_device_type,
    countIf(browser != '') AS has_browser,
    countIf(os != 'Unknown' AND os != '') AS has_os,
    countIf(screen_resolution != '') AS has_screen_resolution,
    
    -- Marketing Properties
    countIf(utm_source != '') AS has_utm_source,
    countIf(utm_medium != '') AS has_utm_medium,
    countIf(utm_campaign != '') AS has_utm_campaign,
    countIf(utm_content != '') AS has_utm_content,
    countIf(is_returning_visitor = true) AS has_returning_visitors,
    
    -- Performance Properties
    countIf(page_load_time_ms > 0) AS has_page_load_time,
    countIf(api_response_time_ms > 0) AS has_api_response_time
    
FROM raw_events
WHERE timestamp >= now() - INTERVAL 7 DAY;
