import { render, screen } from '@testing-library/react';
import { MerchantCard } from '@/components/merchants/merchant-card';

// Mock the shared package
jest.mock('@lma/shared', () => ({
  formatCurrency: (amount: number) => `₹${amount}`,
}));

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}));

const mockMerchant = {
  id: 'merchant-1',
  business_name: 'Test Restaurant',
  slug: 'test-restaurant',
  logo_url: 'https://example.com/logo.png',
  cover_image_url: 'https://example.com/cover.png',
  merchant_type: 'restaurant',
  average_rating: 4.5,
  total_ratings: 100,
  estimated_prep_time: 30,
  min_order_amount: 200,
  city: 'Mumbai',
};

describe('MerchantCard', () => {
  it('renders merchant name', () => {
    render(<MerchantCard merchant={mockMerchant} />);
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
  });

  it('renders merchant type and city', () => {
    render(<MerchantCard merchant={mockMerchant} />);
    expect(screen.getByText(/Restaurant.*Mumbai/)).toBeInTheDocument();
  });

  it('renders rating when available', () => {
    render(<MerchantCard merchant={mockMerchant} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('(100)')).toBeInTheDocument();
  });

  it('renders "New" when rating is 0', () => {
    const newMerchant = { ...mockMerchant, average_rating: 0, total_ratings: 0 };
    render(<MerchantCard merchant={newMerchant} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders estimated prep time', () => {
    render(<MerchantCard merchant={mockMerchant} />);
    expect(screen.getByText('30 min')).toBeInTheDocument();
  });

  it('renders minimum order amount', () => {
    render(<MerchantCard merchant={mockMerchant} />);
    expect(screen.getByText(/Min. order: ₹200/)).toBeInTheDocument();
  });

  it('does not render min order when it is 0', () => {
    const noMinMerchant = { ...mockMerchant, min_order_amount: 0 };
    render(<MerchantCard merchant={noMinMerchant} />);
    expect(screen.queryByText(/Min. order/)).not.toBeInTheDocument();
  });

  it('links to merchant page', () => {
    render(<MerchantCard merchant={mockMerchant} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/merchants/test-restaurant');
  });

  it('renders cover image when available', () => {
    render(<MerchantCard merchant={mockMerchant} />);
    const images = screen.getAllByTestId('next-image');
    expect(images.length).toBeGreaterThan(0);
  });

  it('renders emoji fallback when no cover image', () => {
    const noCoverMerchant = { ...mockMerchant, cover_image_url: null };
    render(<MerchantCard merchant={noCoverMerchant} />);
    expect(screen.getByText('🍽️')).toBeInTheDocument();
  });

  it('renders grocery emoji for grocery type', () => {
    const groceryMerchant = { ...mockMerchant, merchant_type: 'grocery', cover_image_url: null };
    render(<MerchantCard merchant={groceryMerchant} />);
    expect(screen.getByText('🛒')).toBeInTheDocument();
  });

  it('renders pharmacy emoji for pharmacy type', () => {
    const pharmacyMerchant = { ...mockMerchant, merchant_type: 'pharmacy', cover_image_url: null };
    render(<MerchantCard merchant={pharmacyMerchant} />);
    expect(screen.getByText('💊')).toBeInTheDocument();
  });

  it('renders store emoji for other types', () => {
    const otherMerchant = { ...mockMerchant, merchant_type: 'retail', cover_image_url: null };
    render(<MerchantCard merchant={otherMerchant} />);
    expect(screen.getByText('🏪')).toBeInTheDocument();
  });

  it('renders logo when available', () => {
    render(<MerchantCard merchant={mockMerchant} />);
    const images = screen.getAllByTestId('next-image');
    const logoImage = images.find(img => img.getAttribute('alt') === 'Test Restaurant');
    expect(logoImage).toBeInTheDocument();
  });

  it('renders without city when not provided', () => {
    const noCityMerchant = { ...mockMerchant, city: undefined };
    render(<MerchantCard merchant={noCityMerchant} />);
    expect(screen.getByText('Restaurant')).toBeInTheDocument();
    expect(screen.queryByText(/Mumbai/)).not.toBeInTheDocument();
  });

  it('applies hover styles class', () => {
    render(<MerchantCard merchant={mockMerchant} />);
    const card = screen.getByRole('link').firstChild;
    expect(card).toHaveClass('hover:shadow-md');
  });
});
