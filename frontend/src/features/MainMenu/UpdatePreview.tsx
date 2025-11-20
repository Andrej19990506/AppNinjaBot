import React from 'react';
import styled from 'styled-components';
import { latestUpdate } from './updateData';

const Container = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
  color: var(--text-color);
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 50px;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 10px;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  color: var(--text-secondary);
  margin-bottom: 20px;
`;

const VersionBadge = styled.span`
  display: inline-block;
  padding: 8px 16px;
  background: var(--gradient-primary);
  color: white;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9rem;
`;

const Description = styled.div`
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 30px;
  margin-bottom: 40px;
  line-height: 1.8;
  font-size: 1.1rem;
  color: var(--text-color);
  box-shadow: var(--shadow-sm);
`;

const FeaturesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const FeatureCard = styled.div`
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 30px;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
`;

const FeatureTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 15px;
  color: var(--text-color);
`;

const FeatureDescription = styled.p`
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 20px;
  line-height: 1.6;
`;

const FeatureItems = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const FeatureItem = styled.li`
  padding-left: 25px;
  position: relative;
  line-height: 1.7;
  color: var(--text-color);

  &::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--primary-color);
    font-weight: bold;
    font-size: 1.2rem;
  }
`;

const UpdatePreview: React.FC = () => {
  return (
    <Container>
      <Header>
        <Title>{latestUpdate.title}</Title>
        <Subtitle>{latestUpdate.subtitle}</Subtitle>
        <VersionBadge>{latestUpdate.version}</VersionBadge>
      </Header>

      <Description>
        {latestUpdate.description}
      </Description>

      <FeaturesList>
        {latestUpdate.features.map((feature) => (
          <FeatureCard key={feature.id}>
            <FeatureTitle>{feature.title}</FeatureTitle>
            <FeatureDescription>{feature.description}</FeatureDescription>
            <FeatureItems>
              {feature.items.map((item, index) => (
                <FeatureItem key={index}>{item}</FeatureItem>
              ))}
            </FeatureItems>
          </FeatureCard>
        ))}
      </FeaturesList>
    </Container>
  );
};

export default UpdatePreview;

