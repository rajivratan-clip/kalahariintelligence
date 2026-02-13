^CINFO:     Stopping reloader process [59736]
(ai) rajivratan@rajiv-ratan-Clip:~/Downloads/resortiq---hospitality-intelligence$ uvicorn api:app --reload --port 8000 --env-file .env
INFO:     Will watch for changes in these directories: ['/home/rajivratan/Downloads/resortiq---hospitality-intelligence']
INFO:     Loading environment from '.env'
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [60088] using WatchFiles
🔌 Connecting to ClickHouse:
   Host: 20.80.107.200
   Port: 8123
   Username: default
   Password: ***
✓ ClickHouse connected: 20.80.107.200:8123
✓ Azure OpenAI client initialized: gpt-5.2-chat @ https://ai-engineering5524ai609414313484.cognitiveservices.azure.com/
INFO:     Started server process [60090]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     127.0.0.1:50178 - "GET /api/metadata/schema HTTP/1.1" 200 OK
INFO:     127.0.0.1:50180 - "GET /api/metadata/segment-values HTTP/1.1" 200 OK
INFO:     127.0.0.1:50194 - "GET /api/custom-events?user_id=default_user HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "GET /api/funnel/events/dynamic?limit=30 HTTP/1.1" 200 OK
INFO:     127.0.0.1:50194 - "OPTIONS /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:50180 - "OPTIONS /api/funnel/latency HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "GET /api/metadata/schema HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "OPTIONS /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:57772 - "OPTIONS /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57778 - "OPTIONS /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:50194 - "OPTIONS /api/funnel/price-sensitivity HTTP/1.1" 200 OK
INFO:     127.0.0.1:50180 - "OPTIONS /api/funnel/cohort-analysis HTTP/1.1" 200 OK
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:50178 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:57772 - "OPTIONS /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57778 - "OPTIONS /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "OPTIONS /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:50194 - "OPTIONS /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "OPTIONS /api/funnel/latency HTTP/1.1" 200 OK
INFO:     127.0.0.1:57778 - "OPTIONS /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:57772 - "OPTIONS /api/funnel/price-sensitivity HTTP/1.1" 200 OK
INFO:     127.0.0.1:50180 - "OPTIONS /api/funnel/cohort-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "GET /api/custom-events?user_id=default_user HTTP/1.1" 200 OK
INFO:     127.0.0.1:50194 - "GET /api/metadata/segment-values HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:57778 - "GET /api/metadata/schema HTTP/1.1" 200 OK
[Latency Query Error] Received ClickHouse exception, code: 62, server response: Code: 62. DB::Exception: Syntax error: failed at position 858 (step_times) (line 24, col 18): step_times
            WHERE 1=1
        
 FORMAT Native. Expected one of: token sequence, Dot, token, OR, AND, IS NOT DISTINCT FROM, IS DISTINCT FROM, IS NULL, IS NOT NULL, BETWEEN, NOT BETWEEN, LIKE, ILIKE, NOT LIKE, NOT ILIKE, REGEXP, IN, NOT IN, GLOBAL IN, GLOBAL NOT IN, MOD, DIV, alias, AS, Comma, FROM, PREWHERE, WHERE, GROUP BY, WITH, HAVING, WINDOW, QUALIFY, ORDER BY, LIMIT, OFFSET, FETCH, SETTINGS, UNION, EXCEPT, INTERSECT, INTO OUTFILE, FORMAT, ParallelWithClause, PARALLEL WITH, end of query. (SYNTAX_ERROR) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:57772 - "POST /api/funnel/latency HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:50180 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:57772 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:50180 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:57778 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:50194 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "POST /api/funnel/cohort-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:50194 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
[Latency Query Error] Received ClickHouse exception, code: 62, server response: Code: 62. DB::Exception: Syntax error: failed at position 858 (step_times) (line 24, col 18): step_times
            WHERE 1=1
        
 FORMAT Native. Expected one of: token sequence, Dot, token, OR, AND, IS NOT DISTINCT FROM, IS DISTINCT FROM, IS NULL, IS NOT NULL, BETWEEN, NOT BETWEEN, LIKE, ILIKE, NOT LIKE, NOT ILIKE, REGEXP, IN, NOT IN, GLOBAL IN, GLOBAL NOT IN, MOD, DIV, alias, AS, Comma, FROM, PREWHERE, WHERE, GROUP BY, WITH, HAVING, WINDOW, QUALIFY, ORDER BY, LIMIT, OFFSET, FETCH, SETTINGS, UNION, EXCEPT, INTERSECT, INTO OUTFILE, FORMAT, ParallelWithClause, PARALLEL WITH, end of query. (SYNTAX_ERROR) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:57778 - "POST /api/funnel/latency HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:57772 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:50180 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "POST /api/funnel/cohort-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "GET /api/metadata/schema HTTP/1.1" 200 OK
INFO:     127.0.0.1:50194 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57778 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:57772 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:50180 - "POST /api/funnel/latency HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
INFO:     127.0.0.1:57778 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57772 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:50180 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:57772 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:50180 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:40794 - "POST /api/funnel/latency HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:57772 - "POST /api/funnel/latency HTTP/1.1" 200 OK
INFO:     127.0.0.1:50180 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
[Cohort Analysis] Error: Received ClickHouse exception, code: 48, server response: Code: 48. DB::Exception: Correlated subqueries in aggregate function argument are not supported. (NOT_IMPLEMENTED) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:40794 - "POST /api/funnel/cohort-analysis HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:44310 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:50178 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:40794 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:44310 - "GET /api/funnel/friction?step_name=Landed HTTP/1.1" 200 OK
[Cohort Analysis] Error: Received ClickHouse exception, code: 48, server response: Code: 48. DB::Exception: Correlated subqueries in aggregate function argument are not supported. (NOT_IMPLEMENTED) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:57772 - "POST /api/funnel/cohort-analysis HTTP/1.1" 500 Internal Server Error
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:50180 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:50204 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:50178 - "POST /api/funnel HTTP/1.1" 200 OK
[Cohort Analysis] Error: Received ClickHouse exception, code: 48, server response: Code: 48. DB::Exception: Correlated subqueries in aggregate function argument are not supported. (NOT_IMPLEMENTED) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:40794 - "POST /api/funnel/cohort-analysis HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:44310 - "GET /api/funnel/friction?step_name=Landed HTTP/1.1" 200 OK
INFO:     127.0.0.1:57772 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:50180 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:50204 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:50178 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:57772 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:50180 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
[Cohort Analysis] Error: Received ClickHouse exception, code: 48, server response: Code: 48. DB::Exception: Correlated subqueries in aggregate function argument are not supported. (NOT_IMPLEMENTED) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:50204 - "POST /api/funnel/cohort-analysis HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:41068 - "GET /api/metadata/schema HTTP/1.1" 200 OK
INFO:     127.0.0.1:41058 - "GET /api/metadata/segment-values HTTP/1.1" 200 OK
INFO:     127.0.0.1:41056 - "GET /api/custom-events?user_id=default_user HTTP/1.1" 200 OK
INFO:     127.0.0.1:41084 - "GET /api/metadata/schema HTTP/1.1" 200 OK
INFO:     127.0.0.1:41068 - "GET /api/funnel/events/dynamic?limit=30 HTTP/1.1" 200 OK
INFO:     127.0.0.1:41052 - "GET /api/metadata/segment-values HTTP/1.1" 200 OK
INFO:     127.0.0.1:41056 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:41058 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:41068 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
[Latency Query Error] Received ClickHouse exception, code: 62, server response: Code: 62. DB::Exception: Syntax error: failed at position 858 (step_times) (line 24, col 18): step_times
            WHERE 1=1
        
 FORMAT Native. Expected one of: token sequence, Dot, token, OR, AND, IS NOT DISTINCT FROM, IS DISTINCT FROM, IS NULL, IS NOT NULL, BETWEEN, NOT BETWEEN, LIKE, ILIKE, NOT LIKE, NOT ILIKE, REGEXP, IN, NOT IN, GLOBAL IN, GLOBAL NOT IN, MOD, DIV, alias, AS, Comma, FROM, PREWHERE, WHERE, GROUP BY, WITH, HAVING, WINDOW, QUALIFY, ORDER BY, LIMIT, OFFSET, FETCH, SETTINGS, UNION, EXCEPT, INTERSECT, INTO OUTFILE, FORMAT, ParallelWithClause, PARALLEL WITH, end of query. (SYNTAX_ERROR) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:41084 - "POST /api/funnel/latency HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:53626 - "GET /api/custom-events?user_id=default_user HTTP/1.1" 200 OK
INFO:     127.0.0.1:41058 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:41052 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:41056 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:41068 - "POST /api/funnel/cohort-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:41084 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:53626 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:41058 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:41052 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
[Latency Query Error] Received ClickHouse exception, code: 62, server response: Code: 62. DB::Exception: Syntax error: failed at position 858 (step_times) (line 24, col 18): step_times
            WHERE 1=1
        
 FORMAT Native. Expected one of: token sequence, Dot, token, OR, AND, IS NOT DISTINCT FROM, IS DISTINCT FROM, IS NULL, IS NOT NULL, BETWEEN, NOT BETWEEN, LIKE, ILIKE, NOT LIKE, NOT ILIKE, REGEXP, IN, NOT IN, GLOBAL IN, GLOBAL NOT IN, MOD, DIV, alias, AS, Comma, FROM, PREWHERE, WHERE, GROUP BY, WITH, HAVING, WINDOW, QUALIFY, ORDER BY, LIMIT, OFFSET, FETCH, SETTINGS, UNION, EXCEPT, INTERSECT, INTO OUTFILE, FORMAT, ParallelWithClause, PARALLEL WITH, end of query. (SYNTAX_ERROR) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:41056 - "POST /api/funnel/latency HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:41068 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:41084 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
INFO:     127.0.0.1:53626 - "POST /api/funnel/cohort-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:41058 - "GET /api/metadata/schema HTTP/1.1" 200 OK
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:41052 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:41056 - "GET /api/funnel/friction?step_name=Landed HTTP/1.1" 200 OK
INFO:     127.0.0.1:41068 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:53626 - "GET /api/metadata/schema HTTP/1.1" 200 OK
INFO:     127.0.0.1:41058 - "GET /api/funnel/friction?step_name=Landed HTTP/1.1" 200 OK
INFO:     127.0.0.1:57606 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57622 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:57630 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
[Cohort Analysis] Error: Received ClickHouse exception, code: 48, server response: Code: 48. DB::Exception: Correlated subqueries in aggregate function argument are not supported. (NOT_IMPLEMENTED) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:57606 - "POST /api/funnel/cohort-analysis HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:57642 - "POST /api/funnel/latency HTTP/1.1" 200 OK
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:57622 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:57630 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57646 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:57642 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57606 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:57654 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
INFO:     127.0.0.1:57622 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:57646 - "POST /api/funnel/latency HTTP/1.1" 200 OK
INFO:     127.0.0.1:57630 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:57642 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
[Cohort Analysis] Error: Received ClickHouse exception, code: 48, server response: Code: 48. DB::Exception: Correlated subqueries in aggregate function argument are not supported. (NOT_IMPLEMENTED) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:57654 - "POST /api/funnel/cohort-analysis HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:57606 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57622 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57646 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:57630 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:57642 - "POST /api/funnel/latency HTTP/1.1" 200 OK
INFO:     127.0.0.1:57654 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:57606 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
[Cohort Analysis] Error: Received ClickHouse exception, code: 48, server response: Code: 48. DB::Exception: Correlated subqueries in aggregate function argument are not supported. (NOT_IMPLEMENTED) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:57622 - "POST /api/funnel/cohort-analysis HTTP/1.1" 500 Internal Server Error
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:57646 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:57630 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57642 - "GET /api/funnel/friction?step_name=Landed HTTP/1.1" 200 OK
INFO:     127.0.0.1:57654 - "GET /api/funnel/friction?step_name=Location%20Select HTTP/1.1" 200 OK
[Executive Summary] Error: Received ClickHouse exception, code: 47, server response: Code: 47. DB::Exception: Unknown expression or function identifier `dropped_count` in scope SELECT funnel_step, sum(reached_count) AS reached, sum(dropped_count) AS dropped, (sum(dropped_count) / sum(reached_count)) * 100 AS dropoff_rate, sum(total_revenue_at_risk) AS revenue_at_risk FROM mv_funnel_performance WHERE date >= (today() - 30) GROUP BY funnel_step HAVING sum(reached_count) > 100 ORDER BY dropoff_rate DESC LIMIT 3. Maybe you meant: ['reached_count']. (UNKNOWN_IDENTIFIER) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:57606 - "GET /api/funnel/executive-summary?days=30 HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:57622 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57630 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57646 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:57642 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:57654 - "POST /api/funnel/latency HTTP/1.1" 200 OK
INFO:     127.0.0.1:57606 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:57622 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
[Cohort Analysis] Error: Received ClickHouse exception, code: 48, server response: Code: 48. DB::Exception: Correlated subqueries in aggregate function argument are not supported. (NOT_IMPLEMENTED) (for url http://20.80.107.200:8123)
INFO:     127.0.0.1:57646 - "POST /api/funnel/cohort-analysis HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:57630 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57642 - "POST /api/funnel HTTP/1.1" 200 OK
INFO:     127.0.0.1:57654 - "POST /api/funnel/over-time HTTP/1.1" 200 OK
INFO:     127.0.0.1:57606 - "POST /api/funnel/path-analysis HTTP/1.1" 200 OK
INFO:     127.0.0.1:57622 - "POST /api/funnel/latency HTTP/1.1" 200 OK
INFO:     127.0.0.1:57646 - "POST /api/funnel/abnormal-dropoffs HTTP/1.1" 200 OK
INFO:     127.0.0.1:57630 - "POST /api/funnel/price-sensitivity HTTP/1.1" 200 OK
INFO:     127.0.0.1:57654 - "POST /api/funnel HTTP/1.1" 200 OK