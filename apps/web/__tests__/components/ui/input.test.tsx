import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('renders correctly', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders with correct type', () => {
    render(<Input type="email" placeholder="Email" />);
    const input = screen.getByPlaceholderText('Email');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('renders password input', () => {
    render(<Input type="password" placeholder="Password" />);
    const input = screen.getByPlaceholderText('Password');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('applies default styles', () => {
    render(<Input placeholder="Styled" />);
    const input = screen.getByPlaceholderText('Styled');
    expect(input).toHaveClass('flex');
    expect(input).toHaveClass('h-10');
    expect(input).toHaveClass('w-full');
    expect(input).toHaveClass('rounded-md');
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" placeholder="Custom" />);
    const input = screen.getByPlaceholderText('Custom');
    expect(input).toHaveClass('custom-input');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="Disabled" />);
    const input = screen.getByPlaceholderText('Disabled');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('disabled:cursor-not-allowed');
    expect(input).toHaveClass('disabled:opacity-50');
  });

  it('handles value changes', async () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} placeholder="Changeable" />);

    const input = screen.getByPlaceholderText('Changeable');
    await userEvent.type(input, 'Hello');

    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue('Hello');
  });

  it('handles controlled value', () => {
    const { rerender } = render(<Input value="initial" onChange={() => {}} placeholder="Controlled" />);
    const input = screen.getByPlaceholderText('Controlled');
    expect(input).toHaveValue('initial');

    rerender(<Input value="updated" onChange={() => {}} placeholder="Controlled" />);
    expect(input).toHaveValue('updated');
  });

  it('forwards ref correctly', () => {
    const ref = jest.fn();
    render(<Input ref={ref} placeholder="With Ref" />);
    expect(ref).toHaveBeenCalled();
  });

  it('supports number input', async () => {
    render(<Input type="number" placeholder="Number" />);
    const input = screen.getByPlaceholderText('Number');
    expect(input).toHaveAttribute('type', 'number');

    await userEvent.type(input, '123');
    expect(input).toHaveValue(123);
  });

  it('handles focus and blur events', () => {
    const handleFocus = jest.fn();
    const handleBlur = jest.fn();

    render(
      <Input
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Focusable"
      />
    );

    const input = screen.getByPlaceholderText('Focusable');

    fireEvent.focus(input);
    expect(handleFocus).toHaveBeenCalledTimes(1);

    fireEvent.blur(input);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('supports read-only mode', () => {
    render(<Input readOnly value="Read only value" placeholder="ReadOnly" />);
    const input = screen.getByPlaceholderText('ReadOnly');
    expect(input).toHaveAttribute('readonly');
  });

  it('supports required attribute', () => {
    render(<Input required placeholder="Required" />);
    const input = screen.getByPlaceholderText('Required');
    expect(input).toBeRequired();
  });

  it('supports min and max for number inputs', () => {
    render(<Input type="number" min={0} max={100} placeholder="Range" />);
    const input = screen.getByPlaceholderText('Range');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '100');
  });
});
