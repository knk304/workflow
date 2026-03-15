/// <reference types="cypress" />

describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should display the login page', () => {
    cy.contains('Workflow Platform').should('be.visible');
    cy.contains('Case & Task Management System').should('be.visible');
    cy.get('input[formcontrolname="email"]').should('be.visible');
    cy.get('input[formcontrolname="password"]').should('be.visible');
    cy.contains('button', 'Sign In').should('be.visible');
  });

  it('should show demo credentials', () => {
    cy.contains('Demo Credentials').should('be.visible');
    cy.contains('alice@example.com').should('be.visible');
    cy.contains('demo123').should('be.visible');
  });

  it('should reject invalid credentials', () => {
    cy.get('input[formcontrolname="email"]').type('bad@test.com');
    cy.get('input[formcontrolname="password"]').type('wrongpass');
    cy.contains('button', 'Sign In').click();
    cy.get('.bg-red-100').should('be.visible');
  });

  it('should login as manager (Alice) and reach dashboard', () => {
    cy.get('input[formcontrolname="email"]').type('alice@example.com');
    cy.get('input[formcontrolname="password"]').type('demo123');
    cy.contains('button', 'Sign In').click();
    cy.url().should('include', '/dashboard');
    cy.contains('Dashboard').should('be.visible');
    cy.contains('Welcome back').should('be.visible');
  });

  it('should login as admin and reach dashboard', () => {
    cy.get('input[formcontrolname="email"]').type('admin@example.com');
    cy.get('input[formcontrolname="password"]').type('admin123');
    cy.contains('button', 'Sign In').click();
    cy.url().should('include', '/dashboard');
    cy.contains('Dashboard').should('be.visible');
  });

  it('should login as worker (Bob) and reach dashboard', () => {
    cy.get('input[formcontrolname="email"]').type('bob@example.com');
    cy.get('input[formcontrolname="password"]').type('demo123');
    cy.contains('button', 'Sign In').click();
    cy.url().should('include', '/dashboard');
  });

  it('should toggle password visibility', () => {
    cy.get('input[formcontrolname="password"]').should('have.attr', 'type', 'password');
    cy.get('input[formcontrolname="password"]').parent().parent().find('button[mat-icon-button]').click();
    cy.get('input[formcontrolname="password"]').should('have.attr', 'type', 'text');
  });

  it('should navigate to register page', () => {
    cy.contains('Sign up here').click();
    cy.url().should('include', '/register');
    cy.contains('Create Account').should('be.visible');
  });

  it('should redirect unauthenticated user to login', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });
});
