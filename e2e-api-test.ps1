$ErrorActionPreference = "Continue"
$BASE = "http://localhost:8000"
$FE   = "http://localhost:4200"
$pass  = 0
$fail  = 0
$skip  = 0
$errors = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [object]$Body,
        [hashtable]$Headers = @{},
        [string]$ContentType = "application/json",
        [scriptblock]$Validate
    )
    try {
        $params = @{
            Uri             = $Url
            Method          = $Method
            UseBasicParsing = $true
            TimeoutSec      = 15
            ErrorAction     = "Stop"
        }
        if ($Headers.Count -gt 0) { $params["Headers"] = $Headers }
        if ($Body) {
            if ($Body -is [string]) { $params["Body"] = $Body }
            else { $params["Body"] = ($Body | ConvertTo-Json -Depth 10) }
            $params["ContentType"] = $ContentType
        }
        $resp = Invoke-WebRequest @params
        $code = $resp.StatusCode
        $data = $null
        if ($resp.Content) {
            try { $data = $resp.Content | ConvertFrom-Json } catch { $data = $resp.Content }
        }
        if ($Validate) {
            $result = & $Validate $data $code
            if ($result -eq $true) {
                Write-Host "  [PASS] $Name (HTTP $code)" -ForegroundColor Green
                $script:pass++
            } else {
                Write-Host "  [FAIL] $Name (HTTP $code) - Validation: $result" -ForegroundColor Red
                $script:fail++
                $script:errors += "$Name - $result"
            }
        } else {
            if ($code -ge 200 -and $code -lt 300) {
                Write-Host "  [PASS] $Name (HTTP $code)" -ForegroundColor Green
                $script:pass++
            } else {
                Write-Host "  [FAIL] $Name - Unexpected status $code" -ForegroundColor Red
                $script:fail++
                $script:errors += "$Name - HTTP $code"
            }
        }
        return $data
    }
    catch {
        $msg = $_.Exception.Message
        Write-Host "  [FAIL] $Name - $msg" -ForegroundColor Red
        $script:fail++
        $script:errors += "$Name - $msg"
        return $null
    }
}

function Test-ExpectFail {
    param([string]$Name, [string]$Method, [string]$Url, [object]$Body, [hashtable]$Headers = @{})
    try {
        $params = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true; TimeoutSec = 10; ErrorAction = "Stop" }
        if ($Headers.Count -gt 0) { $params["Headers"] = $Headers }
        if ($Body) { $params["Body"] = ($Body | ConvertTo-Json -Depth 5); $params["ContentType"] = "application/json" }
        $resp = Invoke-WebRequest @params
        Write-Host "  [FAIL] $Name - Expected error but got HTTP $($resp.StatusCode)" -ForegroundColor Red
        $script:fail++
        $script:errors += "$Name - Expected error response"
    }
    catch {
        Write-Host "  [PASS] $Name (correctly rejected)" -ForegroundColor Green
        $script:pass++
    }
}

function Auth-Headers([string]$token) {
    return @{ "Authorization" = "Bearer $token" }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  WORKFLOW PLATFORM - End-to-End API Test Suite" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ================================================================
# 0. HEALTH CHECK
# ================================================================
Write-Host "--- [0] Health and Frontend ---" -ForegroundColor Yellow

Test-Endpoint -Name "Backend health" -Method GET -Url "$BASE/health" `
    -Validate { param($d,$c) if ($c -eq 200) { $true } else { "Expected 200" } }

Test-Endpoint -Name "Frontend serving" -Method GET -Url "$FE" `
    -Validate { param($d,$c) if ($c -eq 200) { $true } else { "Expected 200" } }

# ================================================================
# 1. AUTHENTICATION
# ================================================================
Write-Host ""
Write-Host "--- [1] Authentication ---" -ForegroundColor Yellow

$adminLogin = Test-Endpoint -Name "Login as Admin" -Method POST -Url "$BASE/api/auth/login" `
    -Body @{ email = "admin@example.com"; password = "admin123" } `
    -Validate { param($d,$c) if ($d.token -and $d.user.role -eq "ADMIN") { $true } else { "Bad login response" } }
$adminToken = if ($adminLogin) { $adminLogin.token } else { "" }

$aliceLogin = Test-Endpoint -Name "Login as Manager (Alice)" -Method POST -Url "$BASE/api/auth/login" `
    -Body @{ email = "alice@example.com"; password = "demo123" } `
    -Validate { param($d,$c) if ($d.user.role -eq "MANAGER") { $true } else { "Expected MANAGER role" } }
$aliceToken = if ($aliceLogin) { $aliceLogin.token } else { "" }

$bobLogin = Test-Endpoint -Name "Login as Worker (Bob)" -Method POST -Url "$BASE/api/auth/login" `
    -Body @{ email = "bob@example.com"; password = "demo123" } `
    -Validate { param($d,$c) if ($d.user.role -eq "WORKER") { $true } else { "Expected WORKER role" } }
$bobToken = if ($bobLogin) { $bobLogin.token } else { "" }

Test-ExpectFail -Name "Login wrong password (expect 401)" -Method POST -Url "$BASE/api/auth/login" `
    -Body @{ email = "admin@example.com"; password = "wrongpassword" }

Test-Endpoint -Name "GET /api/auth/me" -Method GET -Url "$BASE/api/auth/me" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.email -eq "admin@example.com") { $true } else { "Wrong user: $($d.email)" } }

if ($adminLogin -and $adminLogin.refreshToken) {
    Test-Endpoint -Name "Refresh token" -Method POST -Url "$BASE/api/auth/refresh" `
        -Body @{ refreshToken = $adminLogin.refreshToken } `
        -Headers (Auth-Headers $adminToken) `
        -Validate { param($d,$c) if ($d.token) { $true } else { "No new token" } }
}

$regEmail = "testuser_$(Get-Random -Maximum 99999)@test.com"
$regResult = Test-Endpoint -Name "Register new user" -Method POST -Url "$BASE/api/auth/register" `
    -Body @{ email = $regEmail; password = "Test123!"; name = "Test User"; role = "WORKER" } `
    -Validate { param($d,$c) if ($d.token -or $d.user) { $true } else { "No token or user" } }

Test-ExpectFail -Name "Unauthenticated request (expect 401)" -Method GET -Url "$BASE/api/cases"

# ================================================================
# 2. USERS AND TEAMS
# ================================================================
Write-Host ""
Write-Host "--- [2] Users and Teams ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/users" -Method GET -Url "$BASE/api/users" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 4) { $true } else { "Expected 4+ users, got $($d.Count)" } }

Test-Endpoint -Name "GET /api/users/user-1" -Method GET -Url "$BASE/api/users/user-1" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.name -eq "Alice Johnson") { $true } else { "Wrong name: $($d.name)" } }

Test-Endpoint -Name "GET /api/teams" -Method GET -Url "$BASE/api/teams" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 1) { $true } else { "Expected 1+ teams" } }

# ================================================================
# 3. CASE TYPES
# ================================================================
Write-Host ""
Write-Host "--- [3] Case Types ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/case-types" -Method GET -Url "$BASE/api/case-types" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 1) { $true } else { "Expected 1+ case types" } }

# ================================================================
# 4. CASES
# ================================================================
Write-Host ""
Write-Host "--- [4] Cases ---" -ForegroundColor Yellow

$caseList = Test-Endpoint -Name "GET /api/cases (list)" -Method GET -Url "$BASE/api/cases" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 3) { $true } else { "Expected 3+ cases, got $($d.Count)" } }

Test-Endpoint -Name "GET /api/cases/case-1" -Method GET -Url "$BASE/api/cases/case-1" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.stage -eq "documents" -and $d.priority -eq "high") { $true } else { "Wrong data" } }

$newCase = Test-Endpoint -Name "POST /api/cases (create)" -Method POST -Url "$BASE/api/cases" `
    -Headers (Auth-Headers $adminToken) `
    -Body @{
        type = "loan_origination"; priority = "medium"; ownerId = "user-1"; teamId = "team-1"
        fields = @{ loanAmount = 75000; loanType = "Auto"; applicantName = "E2E Tester"; applicantIncome = 55000 }
        notes = "Created by E2E test"
    } `
    -Validate { param($d,$c) if ($d._id -or $d.id) { $true } else { "No case ID returned" } }
$newCaseId = if ($newCase) { if ($newCase._id) { $newCase._id } else { $newCase.id } } else { $null }

if ($newCaseId) {
    Test-Endpoint -Name "PATCH /api/cases/$newCaseId (update)" -Method PATCH -Url "$BASE/api/cases/$newCaseId" `
        -Headers (Auth-Headers $adminToken) `
        -Body @{ priority = "high"; notes = "Updated by E2E" } `
        -Validate { param($d,$c) $true }

    Test-Endpoint -Name "PATCH /api/cases/$newCaseId/stage (advance)" -Method PATCH `
        -Url "$BASE/api/cases/$newCaseId/stage" `
        -Headers (Auth-Headers $aliceToken) `
        -Body @{ action = "submit"; notes = "E2E stage advance" } `
        -Validate { param($d,$c) $true }
} else {
    Write-Host "  [SKIP] Update/Stage transition - no case created" -ForegroundColor DarkYellow
    $script:skip += 2
}

# ================================================================
# 5. TASKS
# ================================================================
Write-Host ""
Write-Host "--- [5] Tasks ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/tasks (list)" -Method GET -Url "$BASE/api/tasks" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 5) { $true } else { "Expected 5+ tasks, got $($d.Count)" } }

Test-Endpoint -Name "GET /api/tasks/task-1" -Method GET -Url "$BASE/api/tasks/task-1" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.title -eq "Collect income verification") { $true } else { "Wrong title" } }

Test-Endpoint -Name "GET /api/tasks/kanban" -Method GET -Url "$BASE/api/tasks/kanban" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) $true }

$newTask = Test-Endpoint -Name "POST /api/tasks (create)" -Method POST -Url "$BASE/api/tasks" `
    -Headers (Auth-Headers $adminToken) `
    -Body @{
        caseId = "case-1"; title = "E2E Test Task"; description = "Automated test"
        assigneeId = "user-2"; priority = "medium"; dueDate = "2026-04-01T00:00:00Z"
        dependsOn = @(); tags = @("e2e","test")
    } `
    -Validate { param($d,$c) if ($d._id -or $d.id) { $true } else { "No task ID" } }
$newTaskId = if ($newTask) { if ($newTask._id) { $newTask._id } else { $newTask.id } } else { $null }

if ($newTaskId) {
    Test-Endpoint -Name "PATCH /api/tasks/$newTaskId (update)" -Method PATCH `
        -Url "$BASE/api/tasks/$newTaskId" `
        -Headers (Auth-Headers $adminToken) `
        -Body @{ status = "in_progress" } `
        -Validate { param($d,$c) $true }
} else {
    Write-Host "  [SKIP] Update task - not created" -ForegroundColor DarkYellow
    $script:skip++
}

# ================================================================
# 6. COMMENTS
# ================================================================
Write-Host ""
Write-Host "--- [6] Comments ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/comments?caseId=case-1" -Method GET `
    -Url "$BASE/api/comments?caseId=case-1" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 1) { $true } else { "Expected 1+ comments" } }

Test-Endpoint -Name "POST /api/comments (add)" -Method POST -Url "$BASE/api/comments" `
    -Headers (Auth-Headers $adminToken) `
    -Body @{ caseId = "case-1"; text = "E2E test comment"; mentions = @(); userId = "user-admin"; userName = "Admin User" } `
    -Validate { param($d,$c) if ($d._id -or $d.id) { $true } else { "No comment ID" } }

# ================================================================
# 7. NOTIFICATIONS
# ================================================================
Write-Host ""
Write-Host "--- [7] Notifications ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/notifications (Alice)" -Method GET -Url "$BASE/api/notifications" `
    -Headers (Auth-Headers $aliceToken) `
    -Validate { param($d,$c) if ($d.Count -ge 1) { $true } else { "Expected 1+ notifications" } }

Test-Endpoint -Name "PATCH /api/notifications/notif-2/read" -Method PATCH `
    -Url "$BASE/api/notifications/notif-2/read" `
    -Headers (Auth-Headers $aliceToken) `
    -Validate { param($d,$c) $true }

# ================================================================
# 8. WORKFLOWS
# ================================================================
Write-Host ""
Write-Host "--- [8] Workflows ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/workflows (list)" -Method GET -Url "$BASE/api/workflows" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 1) { $true } else { "Expected 1+ workflows" } }

Test-Endpoint -Name "GET /api/workflows/wf-loan" -Method GET -Url "$BASE/api/workflows/wf-loan" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.definition.nodes.Count -ge 8) { $true } else { "Expected 8 nodes" } }

$newWf = Test-Endpoint -Name "POST /api/workflows (create)" -Method POST -Url "$BASE/api/workflows" `
    -Headers (Auth-Headers $adminToken) `
    -Body @{
        name = "E2E Test Workflow"; description = "Test"; case_type = "ct-loan"
        definition = @{
            nodes = @(
                @{ id = "n-s"; type = "start"; label = "Start"; position = @{ x = 0; y = 100 } }
                @{ id = "n-t"; type = "task"; label = "Task"; position = @{ x = 200; y = 100 }; assigneeRole = "WORKER" }
                @{ id = "n-e"; type = "end"; label = "End"; position = @{ x = 400; y = 100 } }
            )
            edges = @(
                @{ id = "e1"; source = "n-s"; target = "n-t" }
                @{ id = "e2"; source = "n-t"; target = "n-e" }
            )
        }
        is_active = $true
    } `
    -Validate { param($d,$c) if ($d._id -or $d.id) { $true } else { "No workflow ID" } }
$newWfId = if ($newWf) { if ($newWf._id) { $newWf._id } else { $newWf.id } } else { $null }

if ($newWfId) {
    Test-Endpoint -Name "POST /api/workflows/$newWfId/validate" -Method POST `
        -Url "$BASE/api/workflows/$newWfId/validate" `
        -Headers (Auth-Headers $adminToken) `
        -Validate { param($d,$c) $true }

    Test-Endpoint -Name "DELETE /api/workflows/$newWfId (cleanup)" -Method DELETE `
        -Url "$BASE/api/workflows/$newWfId" `
        -Headers (Auth-Headers $adminToken) `
        -Validate { param($d,$c) $true }
} else {
    Write-Host "  [SKIP] Validate/Delete workflow - not created" -ForegroundColor DarkYellow
    $script:skip += 2
}

# ================================================================
# 9. APPROVALS
# ================================================================
Write-Host ""
Write-Host "--- [9] Approvals ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/approvals (list)" -Method GET -Url "$BASE/api/approvals" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 1) { $true } else { "Expected 1+ approvals" } }

Test-Endpoint -Name "GET /api/approvals/approval-1" -Method GET -Url "$BASE/api/approvals/approval-1" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.mode -eq "sequential") { $true } else { "Expected sequential" } }

$newApproval = Test-Endpoint -Name "POST /api/approvals (create parallel)" -Method POST -Url "$BASE/api/approvals" `
    -Headers (Auth-Headers $adminToken) `
    -Body @{
        case_id = "case-2"; mode = "parallel"
        approvers = @( @{ user_id = "user-1"; sequence = 0 }, @{ user_id = "user-admin"; sequence = 0 } )
    } `
    -Validate { param($d,$c) if ($d.mode -eq "parallel") { $true } else { "Expected parallel mode" } }
$newApprovalId = if ($newApproval) { if ($newApproval._id) { $newApproval._id } else { $newApproval.id } } else { $null }

if ($newApprovalId) {
    Test-Endpoint -Name "POST /api/approvals/$newApprovalId/approve" -Method POST `
        -Url "$BASE/api/approvals/$newApprovalId/approve" `
        -Headers (Auth-Headers $adminToken) `
        -Body @{ notes = "Approved via E2E" } `
        -Validate { param($d,$c) $true }
} else {
    Write-Host "  [SKIP] Approve approval - not created" -ForegroundColor DarkYellow
    $script:skip++
}

if ($newApprovalId) {
    Test-Endpoint -Name "POST /api/approvals/$newApprovalId/reject" -Method POST `
        -Url "$BASE/api/approvals/$newApprovalId/reject" `
        -Headers (Auth-Headers $aliceToken) `
        -Body @{ notes = "Rejected via E2E" } `
        -Validate { param($d,$c) $true }
} else {
    Write-Host "  [SKIP] Reject approval - not created" -ForegroundColor DarkYellow
    $script:skip++
}

# ================================================================
# 10. SLA
# ================================================================
Write-Host ""
Write-Host "--- [10] SLA Definitions ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/sla/definitions (list)" -Method GET -Url "$BASE/api/sla/definitions" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 3) { $true } else { "Expected 3+ SLAs" } }

Test-Endpoint -Name "GET /api/sla/dashboard" -Method GET -Url "$BASE/api/sla/dashboard" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) $true }

# ================================================================
# 11. FORMS
# ================================================================
Write-Host ""
Write-Host "--- [11] Forms ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/forms/definitions (list)" -Method GET -Url "$BASE/api/forms/definitions" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 1) { $true } else { "Expected 1+ forms" } }

Test-Endpoint -Name "GET /api/forms/definitions/form-loan-intake" -Method GET `
    -Url "$BASE/api/forms/definitions/form-loan-intake" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.fields.Count -ge 8) { $true } else { "Expected 8 fields" } }

Test-Endpoint -Name "POST /api/forms/submissions" -Method POST `
    -Url "$BASE/api/forms/submissions" `
    -Headers (Auth-Headers $adminToken) `
    -Body @{
        form_id = "form-loan-intake"
        case_id = "case-1"
        data = @{
            "f-name" = "E2E Tester"; "f-email" = "e2e@test.com"; "f-income" = 90000
            "f-loan-type" = "Personal"; "f-amount" = 50000; "f-purpose" = "Testing"; "f-terms" = $true
        }
    } `
    -Validate { param($d,$c) $true }

# ================================================================
# 12. DOCUMENTS
# ================================================================
Write-Host ""
Write-Host "--- [12] Documents ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/documents (list)" -Method GET -Url "$BASE/api/documents" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.Count -ge 2) { $true } else { "Expected 2+ documents" } }

Test-Endpoint -Name "GET /api/documents/doc-1" -Method GET -Url "$BASE/api/documents/doc-1" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) if ($d.file_name -eq "w2_john_doe_2024.pdf") { $true } else { "Wrong filename" } }

# ================================================================
# 13. AUDIT LOGS
# ================================================================
Write-Host ""
Write-Host "--- [13] Audit Logs ---" -ForegroundColor Yellow

Test-Endpoint -Name "GET /api/audit-logs" -Method GET -Url "$BASE/api/audit-logs" `
    -Headers (Auth-Headers $adminToken) `
    -Validate { param($d,$c) $true }

# ================================================================
# 14. CROSS-ROLE CHECKS
# ================================================================
Write-Host ""
Write-Host "--- [14] Cross-Role Access ---" -ForegroundColor Yellow

Test-Endpoint -Name "Worker (Bob) lists cases" -Method GET -Url "$BASE/api/cases" `
    -Headers (Auth-Headers $bobToken) `
    -Validate { param($d,$c) if ($d.Count -ge 1) { $true } else { "No cases for worker" } }

Test-Endpoint -Name "Worker (Bob) lists tasks" -Method GET -Url "$BASE/api/tasks" `
    -Headers (Auth-Headers $bobToken) `
    -Validate { param($d,$c) $true }

Test-Endpoint -Name "Manager (Alice) lists workflows" -Method GET -Url "$BASE/api/workflows" `
    -Headers (Auth-Headers $aliceToken) `
    -Validate { param($d,$c) $true }

# ================================================================
# 15. CLEANUP
# ================================================================
Write-Host ""
Write-Host "--- [15] Cleanup ---" -ForegroundColor Yellow

# Note: No DELETE endpoint for cases, skipping cleanup
if ($newCaseId) {
    Write-Host "  [INFO] Test case $newCaseId left in DB (no delete endpoint)" -ForegroundColor DarkYellow
}

# Note: No DELETE endpoint for tasks, skipping cleanup
Write-Host "  [INFO] Test task $newTaskId left in DB (no delete endpoint)" -ForegroundColor DarkYellow

# ================================================================
# SUMMARY
# ================================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$total = $pass + $fail + $skip
Write-Host "  Total:   $total" -ForegroundColor White
Write-Host "  Passed:  $pass" -ForegroundColor Green
if ($fail -eq 0) {
    Write-Host "  Failed:  $fail" -ForegroundColor Green
} else {
    Write-Host "  Failed:  $fail" -ForegroundColor Red
}
Write-Host "  Skipped: $skip" -ForegroundColor DarkYellow
Write-Host ""

if ($errors.Count -gt 0) {
    Write-Host "  FAILURES:" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host "    - $e" -ForegroundColor Red
    }
    Write-Host ""
}

$pct = if ($total -gt 0) { [math]::Round(($pass / $total) * 100, 1) } else { 0 }
if ($fail -eq 0) {
    Write-Host "  ALL TESTS PASSED ($pct%)" -ForegroundColor Green
} else {
    Write-Host "  $fail TEST(S) FAILED ($pct% pass rate)" -ForegroundColor Red
}
Write-Host ""
