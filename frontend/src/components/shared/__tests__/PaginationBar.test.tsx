import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaginationBar } from '../PaginationBar';

const baseProps = {
  page: 1,
  totalPages: 5,
  totalItems: 50,
  showingText: 'Showing 1–10 of 50',
  prevPage: jest.fn(),
  nextPage: jest.fn(),
  setPage: jest.fn(),
  isFirstPage: true,
  isLastPage: false,
};

describe('PaginationBar', () => {
  it('renders showingText', () => {
    render(<PaginationBar {...baseProps} />);
    expect(screen.getByText('Showing 1–10 of 50')).toBeInTheDocument();
  });

  it('returns null when totalItems is 0', () => {
    const { container } = render(<PaginationBar {...baseProps} totalItems={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('disables previous button on first page', () => {
    render(<PaginationBar {...baseProps} isFirstPage />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<PaginationBar {...baseProps} page={5} isFirstPage={false} isLastPage />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('calls nextPage when next button clicked', () => {
    const nextPage = jest.fn();
    render(<PaginationBar {...baseProps} nextPage={nextPage} />);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(nextPage).toHaveBeenCalledTimes(1);
  });

  it('calls setPage with page number on page button click', () => {
    const setPage = jest.fn();
    render(<PaginationBar {...baseProps} setPage={setPage} />);
    fireEvent.click(screen.getByText('2'));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('hides pagination controls when only one page', () => {
    render(<PaginationBar {...baseProps} totalPages={1} isLastPage />);
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
  });
});
