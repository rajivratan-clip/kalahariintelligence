-- Create table for user-defined custom event templates
-- This allows users to create reusable event definitions from generic events + filters

CREATE TABLE IF NOT EXISTS custom_event_templates (
    template_id String,
    user_id String DEFAULT 'default_user',  -- For multi-tenant support later
    template_name String,
    description String DEFAULT '',
    base_event_type String,  -- e.g., "Page Viewed", "Click", "Form Submitted"
    base_event_category String DEFAULT 'generic',  -- 'generic' or 'custom'
    filters String,  -- JSON string of filter array: [{"property":"page_category","operator":"equals","value":"addon"}]
    icon String DEFAULT '📦',  -- Emoji or icon identifier
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (user_id, template_id);

-- Example data (optional - for testing)
-- INSERT INTO custom_event_templates (template_id, template_name, description, base_event_type, filters, icon) VALUES
--   ('custom_1', 'Add-on Viewed', 'User viewed add-on options', 'Page Viewed', '[{"property":"page_category","operator":"equals","value":"addon"}]', '🎁'),
--   ('custom_2', 'Cart Button Clicked', 'User clicked add to cart', 'Click', '[{"property":"element_selector","operator":"contains","value":"cart-button"}]', '🛒');

-- Verify table creation
SELECT 'Custom event templates table created successfully!' as status;
