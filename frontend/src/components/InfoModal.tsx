import React from 'react';
import { Modal, Button } from './ui';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <>
          <img src="/rock.svg" alt="BikeMap" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '6px' }} />
          About BikeMap
        </>
      }
      showCloseButton={false}
      centerTitle={true}
    >
      <div>
        {/* App Description */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '16px', 
            fontWeight: '600',
            color: '#212529'
          }}>
            🚵 Mountain Bike Trail Sharing
          </h4>
          <p style={{ 
            margin: '0 0 16px 0', 
            fontSize: '14px', 
            lineHeight: '1.5',
            color: '#495057'
          }}>
            BikeMap is a community-driven platform for sharing and discovering mountain bike trails. 
            Upload your favorite trails, explore new routes, and connect with fellow riders.
          </p>
        </div>

        {/* Difficulty Levels */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '16px', 
            fontWeight: '600',
            color: '#212529'
          }}>
            🎯 Difficulty Levels
          </h4>
          <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <span className="level-s0" style={{ marginRight: '8px', fontSize: '11px' }}>S0</span>
                <span style={{ color: '#212529', fontWeight: '600' }}>Green - Easy</span>
              </div>
              <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                Flat trails through forests or meadows on natural adherent surfaces or flat rock. No steps, rocks, or many roots. Gentle gradient, wide turns. No specific technique required.
              </p>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <span className="level-s1" style={{ marginRight: '8px', fontSize: '11px' }}>S1</span>
                <span style={{ color: '#212529', fontWeight: '600' }}>Blue - Easy</span>
              </div>
              <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                Small obstacles like flat roots, small stones, water channels. Partly unstable ground. Gradients up to 40%. No hairpin turns. Basic MTB knowledge needed: braking technique and good body balance.
              </p>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <span className="level-s2" style={{ marginRight: '8px', fontSize: '11px' }}>S2</span>
                <span style={{ color: '#212529', fontWeight: '600' }}>Orange - Intermediate</span>
              </div>
              <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                Larger roots, stones, steps, and tight turns. Gradients up to 70%. Required: braking technique and body weight transfer to overcome obstacles.
              </p>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <span className="level-s3" style={{ marginRight: '8px', fontSize: '11px' }}>S3</span>
                <span style={{ color: '#212529', fontWeight: '600' }}>Red - Advanced</span>
              </div>
              <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                Path obstructed by rocks, roots, large steps. Rocky and slippery terrain, hairpin turns and stairs. Gradient over 70%. Very good MTB mastery required: precise braking and excellent balance.
              </p>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <span className="level-s4" style={{ marginRight: '8px', fontSize: '11px' }}>S4</span>
                <span style={{ color: '#212529', fontWeight: '600' }}>Purple - Expert</span>
              </div>
              <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                Very steep and heavily obstructed terrain. Steep sections, tight hairpin turns, large steps. Trial techniques, front and rear wheel pivots, perfect braking essential. Only for extreme mountain bikers! Bike can hardly be pushed/carried.
              </p>
            </div>
            
            <div style={{ marginBottom: '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <span className="level-s5" style={{ marginRight: '8px', fontSize: '11px' }}>S5</span>
                <span style={{ color: '#212529', fontWeight: '600' }}>Black - Extreme</span>
              </div>
              <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                Very heavily obstructed terrain with large climbs. Loose terrain with scree/large obstacles like tree trunks and consecutive high steps. Little momentum, short braking distance. Reserved only for extreme mountain bikers! Bike can hardly be pushed/carried.
              </p>
            </div>
          </div>
        </div>

        {/* Trail Segments Preference */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '16px', 
            fontWeight: '600',
            color: '#212529'
          }}>
            🛤️ Trail Segments vs Tours
          </h4>
          <p style={{ 
            margin: 0, 
            fontSize: '14px', 
            lineHeight: '1.5',
            color: '#495057'
          }}>
            We prefer individual trail segments over complete tours. This allows riders to mix and match 
            trails based on their skill level and preferences, creating custom riding experiences.
          </p>
        </div>

        {/* GitHub Link */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '16px', 
            fontWeight: '600',
            color: '#212529'
          }}>
            💻 Open Source
          </h4>
          <p style={{ 
            margin: '0 0 12px 0', 
            fontSize: '14px', 
            lineHeight: '1.5',
            color: '#495057'
          }}>
            BikeMap is open source! Check out the code, contribute, or report issues:
          </p>
          <a 
            href="https://github.com/MartinMeyer1/bike-map" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: 'linear-gradient(135deg, #24292e 0%, #586069 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(36,41,46,0.2)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(36,41,46,0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(36,41,46,0.2)';
            }}
          >
            📂 GitHub Repository
          </a>
        </div>

        {/* Close Button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
          <Button 
            variant="primary"
            onClick={onClose}
          >
            ✓ Got it!
          </Button>
        </div>
      </div>
    </Modal>
  );
};