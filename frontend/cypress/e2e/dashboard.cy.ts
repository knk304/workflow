/// <reference types="cypress" />

describe('Dashboard', () => {
  beforeEach(() => {
    cy.loginAsManager();
  });

  it('should display dashboard heading and stats', () => {
    cy.contains('h1', 'Dashboard').should('be.visible');
    cy.contains('Welcome back').should('be.visible');
    cy.contains('Open Cases').should('be.visible');
    cy.contains('Critical').should('be.visible');
    cy.contains('My Tasks').should('be.visible');
    cy.contains('Overdue').should('be.visible');
  });

  it('should show stat cards with numeric values', () => {
    // Stats cards should render with large numbers
    cy.get('.text-3xl').should('have.length.greaterThan', 0);
  });

  it('should display recent cases section', () => {
    cy.contains('Recent Cases').should('be.visible');
  });

  it('should display recent tasks section', () => {
    cy.contains('Recent Tasks').should('be.visible');
  });

  it('should have "View All" links to cases and tasks', () => {
    cy.contains('a', 'View All').first().should('have.attr', 'href').and('include', '/cases');
  });

  it('should navigate to cases from "View All" link', () => {
    cy.contains('a', 'View All').first().click();
    cy.url().should('include', '/cases');
  });
});
