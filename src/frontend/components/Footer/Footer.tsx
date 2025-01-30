import React from 'react'
import Link from 'next/link'
import ReactTooltip from 'react-tooltip'

import { Icon, iconTypes } from '../Icon'
import { Spacer } from '../Spacer'
import Image from 'next/image'

import styles from './Footer.module.scss'

const resources = [
  { href: 'https://liberdus.com', label: 'About Liberdus' },
  { href: 'https://docs.liberdus.com', label: 'Liberdus Docs' },
  { href: 'https://docs.liberdus.com/faucet/claim', label: 'Testnet LIB Claim' },
]

const socials = [
  { iconName: 'discord', title: 'Discord', href: 'https://discord.gg/liberdus' },
  { iconName: 'twitter', title: 'Twitter', href: 'https://twitter.com/liberdus' },
  { iconName: 'telegram', title: 'Telegram', href: 'https://telegram.me/liberdus' },
  { iconName: 'reddit', title: 'Reddit', href: 'https://www.reddit.com/r/liberdus/' },
]

export const Footer: React.FC = () => {
  return (
    <div className={styles.Footer}>
      <div className={styles.main}>
        <div>
          <div className={styles.logoItem}>
            {/* <Icon name="logo" className={styles.icon} size="large" /> */}
            <Image src="/favicon.ico" alt="Image" width={32} height={32} className={styles.icon} />
            <div className={styles.name}>
              Powered by <span>Liberdus</span>
            </div>
          </div>
          <Spacer space="16" />
          <div className={styles.label}>
            Liberdus is a decentralized, open source, encrypted messaging and payment app. It is developed
            using Shardus technology which uses dynamic state sharding which solves the problems of
            scalability, decentralization and security of the blockchain.
          </div>
        </div>
        <div></div>
        <div></div>
        <div>
          <div className={styles.title}>Resources</div>
          <hr />
          {resources.map((item, index) => (
            <div key={`${index}-${item.label}`}>
              <Link href={item.href} className={styles.link}>
                {item.label}
              </Link>
              <Spacer space="8" />
            </div>
          ))}
        </div>
      </div>
      <hr />
      <div className={styles.social}>
        <div>
          <span>Liberdus</span> © 2025
        </div>
        <div className={styles.wrapper}>
          {socials.map((social, index) => (
            <a
              key={`${index}-${social.iconName}`}
              target="_blank"
              href={social.href}
              rel="noopener noreferrer"
              className={styles.socialBtn}
              data-tip={social.title}
              data-for="fsb"
            >
              <Icon name={social.iconName as keyof typeof iconTypes} color="black" />
            </a>
          ))}
          <ReactTooltip effect="solid" backgroundColor="#6610f2" id="fsb" />
        </div>
      </div>
    </div>
  )
}
