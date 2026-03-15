/// <reference types="cypress" />

describe('Full End-to-End Workflow', () => {
  it('should complete login → dashboard → cases → case detail flow', () => {
    // 1. Login
    cy.visit('/login');
    cy.get('input[formcontrolname="email"]').type('alice@example.com');
    cy.get('input[formcontrolname="password"]').type('demo123');
    cy.contains('button', 'Sign In').click();

    // 2. Dashboard loads
    cy.url().should('include', '/dashboard');
    cy.contains('Dashboard').should('be.visible');
    cy.contains('Open Cases').should('be.visible');

    // 3. Navigate to Cases
    cy.contains('a', 'Cases').click();
    cy.url().should('include', '/cases');
    cy.contains('h1', 'Cases').should('be.visible');

    // 4. Open a case
    cy.get('a.text-blue-600').first().click();
    cy.url().should('match', /\/cases\/.+/);

    // 5. Go back to cases
    cy.go('back');
    cy.url().should('include', '/cases');
  });

  it('should complete login → dashboard → tasks flow', () => {
    cy.loginAsManager();

    // Navigate to Tasks
    cy.contains('a', 'My Tasks').click();
    cy.url().should('include', '/tasks');
    cy.contains('Task Kanban Board').should('be.visible');

    // Verify columns exist
    cy.contains('Pending').should('be.visible');
    cy.contains('In Progress').should('be.visible');
  });

  it('should complete login → navigate all main pages', () => {
    cy.loginAsAdmin();

    // Dashboard
    cy.url().should('include', '/dashboard');

    // Cases
    cy.contains('a', 'Cases').click();
    cy.url().should('include', '/cases');

    // Tasks
    cy.contains('a', 'My Tasks').click();
    cy.url().should('include', '/tasks');

    // Documents
    cy.contains('a', 'Documents').click();
    cy.url().should('include', '/documents');

    // Approvals
    cy.contains('a', 'Approvals').click();
    cy.url().should('include', '/approvals');

    // Workflows (Tools)
    cy.contains('a', 'Workflow Designer').click();
    cy.url().should('include', '/workflows');

    // Form Builder (Tools)
    cy.contains('a', 'Form Builder').click();
    cy.url().should('include', '/forms');

    // SLA Dashboard (Tools)
    cy.contains('a', 'SLA Dashboard').click();
    cy.url().should('include', '/sla');

    // Admin Users
    cy.contains('a', 'Users').click();
    cy.url().should('include', '/admin/users');

    // Admin Teams
    cy.contains('a', 'Teams').click();
    cy.url().should('include', '/admin/teams');

    // Back to dashboard
    cy.contains('a', 'Dashboard').click();
    cy.url().should('include', '/dashboard');
  });

  it('should complete login → logout → redirect to login', () => {
    cy.loginAsManager();
    cy.url().should('include', '/dashboard');

    // Open user menu and sign out
    cy.contains('span', 'Alice Johnson').click();
    cy.contains('Sign Out').click();
    cy.url().should('include', '/login');

    // Verify can't access dashboard when logged out
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });
});
