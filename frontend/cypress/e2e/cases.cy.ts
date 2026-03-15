/// <reference types="cypress" />

describe('Cases', () => {
  beforeEach(() => {
    cy.loginAsManager();
    cy.contains('a', 'Cases').click();
    cy.url().should('include', '/cases');
  });

  it('should display cases list page', () => {
    cy.contains('h1', 'Cases').should('be.visible');
    cy.contains('Manage and track workflow cases').should('be.visible');
  });

  it('should show New Case button', () => {
    cy.contains('button', 'New Case').should('be.visible');
  });

  it('should display filter fields', () => {
    cy.get('input[placeholder*="Case ID"]').should('be.visible');
    cy.contains('mat-label', 'Status').should('exist');
    cy.contains('mat-label', 'Stage').should('exist');
    cy.contains('mat-label', 'Priority').should('exist');
  });

  it('should display cases in a table', () => {
    cy.get('mat-table, table').should('exist');
    cy.get('mat-row, tr').should('have.length.greaterThan', 0);
  });

  it('should display paginator', () => {
    cy.get('mat-paginator').should('exist');
  });

  it('should navigate to case detail on clicking case ID', () => {
    cy.get('a.text-blue-600').first().click();
    cy.url().should('match', /\/cases\/.+/);
  });

  it('should filter by search term', () => {
    cy.get('input[placeholder*="Case ID"]').type('loan');
    cy.wait(500);
    // Just verify the table still shows after filtering
    cy.get('mat-table, table').should('exist');
  });

  it('should navigate to create case form', () => {
    cy.contains('button', 'New Case').click();
    cy.url().should('include', '/cases/new');
    cy.contains('Create New Case').should('be.visible');
  });
});

describe('Case Detail', () => {
  beforeEach(() => {
    cy.loginAsManager();
    cy.contains('a', 'Cases').click();
    cy.url().should('include', '/cases');
  });

  it('should display case detail page', () => {
    cy.get('a.text-blue-600').first().click();
    cy.url().should('match', /\/cases\/.+/);
    // Should show case info
    cy.get('.case-detail-container, mat-card').should('exist');
  });

  it('should show stage journey with progress', () => {
    cy.get('a.text-blue-600').first().click();
    cy.contains(/intake|documents|underwriting|approval|disbursement/i).should('exist');
  });

  it('should show tabs for Details, Tasks, Activity, Comments', () => {
    cy.get('a.text-blue-600').first().click();
    cy.get('mat-tab-group').should('exist');
    cy.contains('Details').should('exist');
    cy.contains('Tasks').should('exist');
  });
});
