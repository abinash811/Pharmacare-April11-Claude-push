import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from '../SearchInput';

describe('SearchInput', () => {
  it('renders with placeholder', () => {
    render(<SearchInput value="" onChange={jest.fn()} placeholder="Search medicines" />);
    expect(screen.getByPlaceholderText('Search medicines')).toBeInTheDocument();
  });

  it('displays current value', () => {
    render(<SearchInput value="aspirin" onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('aspirin')).toBeInTheDocument();
  });

  it('calls onChange with new string value on input', () => {
    const onChange = jest.fn();
    render(<SearchInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'para' } });
    expect(onChange).toHaveBeenCalledWith('para');
  });

  it('renders search icon', () => {
    const { container } = render(<SearchInput value="" onChange={jest.fn()} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
